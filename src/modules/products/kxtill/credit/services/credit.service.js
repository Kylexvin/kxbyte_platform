// src/modules/products/kxtill/credit/services/credit.service.js

import prisma from '../../../../../database/postgres/prisma.js';
import creditDb from '../db/credit.db.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import audit from '../../../../platform/audit/index.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// HELPERS
// ============================================================

const assertMembership = async (userId, organizationId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }
  return membership;
};

const assertCustomer = async (customerId, organizationId) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
  });
  if (!customer) {
    throw new Error('Customer not found');
  }
  return customer;
};

// ============================================================
// PUBLIC READS
// ============================================================

const getBalance = async (organizationId, userId, customerId) => {
  await assertMembership(userId, organizationId);
  await assertCustomer(customerId, organizationId);

  const balance = await creditDb.sumLedgerForCustomer(customerId, organizationId);

  // Determine creditEnabled status from the active branch settings if available
  return { customerId, balance };
};

const getLedger = async (organizationId, userId, customerId, filters = {}) => {
  await assertMembership(userId, organizationId);
  await assertCustomer(customerId, organizationId);

  const result = await creditDb.findEntriesByCustomer(customerId, organizationId, filters);
  const balance = await creditDb.sumLedgerForCustomer(customerId, organizationId);

  return { ...result, balance };
};

// ============================================================
// PUBLIC WRITES
// ============================================================

const recordPayment = async (organizationId, userId, customerId, data) => {
  await assertMembership(userId, organizationId);
  const customer = await assertCustomer(customerId, organizationId);

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  // Optional guard: prevent paying more than the customer owes.
  const currentBalance = await creditDb.sumLedgerForCustomer(customerId, organizationId);
  if (currentBalance <= 0) {
    throw new Error('Customer has no outstanding balance');
  }
  if (amount > currentBalance + 0.01) {
    throw new Error(
      `Payment exceeds outstanding balance (${currentBalance.toFixed(2)})`
    );
  }

  const entry = await creditDb.createEntry({
    organizationId,
    customerId,
    branchId: data.branchId || null,
    shiftId: data.shiftId || null,
    type: 'PAYMENT',
    amount: -amount, // negative — reduces debt
    note: data.note || null,
    createdById: userId,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CREDIT_PAYMENT',
    resource: 'credit_ledger',
    resourceId: entry.id,
    metadata: {
      customerId,
      customerName: customer.name,
      amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance - amount,
      branchId: data.branchId || null,
      shiftId: data.shiftId || null,
    },
  });

  return {
    entry,
    balance: currentBalance - amount,
  };
};

const recordAdjustment = async (organizationId, userId, customerId, data) => {
  await assertMembership(userId, organizationId);

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.credit.adjust');
  if (!hasPermission) {
    throw new Error('You do not have permission to adjust credit');
  }

  const customer = await assertCustomer(customerId, organizationId);

  const direction = String(data.direction || '').toUpperCase();
  if (direction !== 'INCREASE' && direction !== 'DECREASE') {
    throw new Error("Adjustment direction must be 'INCREASE' or 'DECREASE'");
  }

  const magnitude = Number(data.amount);
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new Error('Adjustment amount must be a positive number');
  }

  if (!data.note || !data.note.trim()) {
    throw new Error('Adjustment note is required');
  }

  const signedAmount = direction === 'DECREASE' ? -magnitude : magnitude;

  const balanceBefore = await creditDb.sumLedgerForCustomer(customerId, organizationId);

  const entry = await creditDb.createEntry({
    organizationId,
    customerId,
    branchId: data.branchId || null,
    type: 'ADJUSTMENT',
    amount: signedAmount,
    note: data.note.trim(),
    createdById: userId,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CREDIT_ADJUSTMENT',
    resource: 'credit_ledger',
    resourceId: entry.id,
    metadata: {
      customerId,
      customerName: customer.name,
      direction,
      magnitude,
      signedAmount,
      balanceBefore,
      balanceAfter: balanceBefore + signedAmount,
      note: data.note.trim(),
    },
  });

  return {
    entry,
    balance: balanceBefore + signedAmount,
  };
};

const setCreditLimit = async (organizationId, userId, customerId, limit) => {
  await assertMembership(userId, organizationId);

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.credit.adjust');
  if (!hasPermission) {
    throw new Error('You do not have permission to set credit limits');
  }

  const customer = await assertCustomer(customerId, organizationId);

  const parsedLimit =
    limit === null || limit === undefined || limit === ''
      ? null
      : Number(limit);

  if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit < 0)) {
    throw new Error('Credit limit must be a non-negative number or null');
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { creditLimit: parsedLimit },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CREDIT_LIMIT_SET',
    resource: 'customer',
    resourceId: customerId,
    metadata: {
      customerName: customer.name,
      previousLimit: customer.creditLimit,
      newLimit: parsedLimit,
    },
  });

  return updated;
};

// ============================================================
// INTERNAL — SALE FLOW
// ============================================================

/**
 * Called from createSale / createOfflineSale inside a $transaction.
 * Writes a CHARGE row for the credit portion of the sale.
 * No permission check — the caller already validated.
 * Accepts tx so it joins the sale's transaction.
 */
const recordCharge = async (
  {
    organizationId,
    customerId,
    branchId,
    saleId,
    shiftId,
    amount,
    createdById,
  },
  tx = prisma
) => {
  if (!customerId) {
    throw new Error('Credit sale requires a customer');
  }

  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Credit charge amount must be positive');
  }

  return creditDb.createEntry(
    {
      organizationId,
      customerId,
      branchId: branchId || null,
      saleId: saleId || null,
      shiftId: shiftId || null,
      type: 'CHARGE',
      amount: parsed, // positive — increases debt
      note: 'Credit sale',
      createdById,
    },
    tx
  );
};

/**
 * Called from refundSale inside the transaction. Reverses a portion of a
 * specific CHARGE row. Always links to the original charge for audit.
 */
const recordReversal = async (
  {
    organizationId,
    customerId,
    saleId,
    chargeLedgerEntryId,
    amount,
    note,
    createdById,
  },
  tx = prisma
) => {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Reversal amount must be positive');
  }

  return creditDb.createEntry(
    {
      organizationId,
      customerId,
      branchId: null,
      saleId: saleId || null,
      shiftId: null,
      reversalOfId: chargeLedgerEntryId || null,
      type: 'REVERSAL',
      amount: -parsed, // negative — reduces debt
      note: note || 'Refund reversal',
      createdById,
    },
    tx
  );
};

/**
 * Called from createSale before committing the sale.
 * Enforces the customer's creditLimit if set.
 */
const checkCreditLimit = async (customerId, organizationId, addedAmount, tx = prisma) => {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, organizationId },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (customer.creditLimit === null || customer.creditLimit === undefined) {
    return; // no limit
  }

  const currentBalance = await creditDb.sumLedgerForCustomer(customerId, organizationId, tx);
  const newBalance = currentBalance + Number(addedAmount);
  const limit = Number(customer.creditLimit);

  if (newBalance > limit + 0.01) {
    const available = Math.max(0, limit - currentBalance);
    throw new Error(
      `Credit limit exceeded. Available: ${available.toFixed(2)}, requested: ${Number(addedAmount).toFixed(2)}`
    );
  }
};

// ============================================================
// INTERNAL — REFUND FLOW HELPERS
// ============================================================

/**
 * Given a sale, compute what remains refundable and how much of it is
 * allocated to each payment method. Never derives from customer balance.
 */
const getRefundableComponents = async (saleId, organizationId) => {
  const sale = await prisma.kxTillSale.findFirst({
    where: { id: saleId, organizationId },
    include: { payments: true },
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  // Payments on the sale (initial)
  const cashPaid = sale.payments
    .filter((p) => p.method === 'CASH')
    .reduce((s, p) => s + Number(p.amount), 0);
  const creditPaid = sale.payments
    .filter((p) => p.method === 'CREDIT')
    .reduce((s, p) => s + Number(p.amount), 0);
  const otherPaid = sale.payments
    .filter((p) => p.method !== 'CASH' && p.method !== 'CREDIT')
    .reduce((s, p) => s + Number(p.amount), 0);

  // Find the charge ledger row(s) for this sale
  const chargeEntries = await prisma.customerCreditLedger.findMany({
    where: { saleId, type: 'CHARGE' },
  });
  const totalCharged = chargeEntries.reduce((s, e) => s + Number(e.amount), 0);

  // Find reversals already done against those charges
  const chargeIds = chargeEntries.map((e) => e.id);
  const reversals = chargeIds.length
    ? await prisma.customerCreditLedger.findMany({
        where: { reversalOfId: { in: chargeIds }, type: 'REVERSAL' },
      })
    : [];
  const totalReversed = reversals.reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

  const creditRefundable = Math.max(0, totalCharged - totalReversed);

  return {
    saleId,
    saleTotal: Number(sale.totalAmount),
    paidSplit: {
      cash: cashPaid,
      credit: creditPaid,
      other: otherPaid,
    },
    creditCharged: totalCharged,
    creditAlreadyReversed: totalReversed,
    creditRefundable,
    creditCustomerId: sale.customerId,
    chargeLedgerEntryIds: chargeIds,
  };
};

export default {
  // Public
  getBalance,
  getLedger,
  recordPayment,
  recordAdjustment,
  setCreditLimit,
  // Internal
  recordCharge,
  recordReversal,
  checkCreditLimit,
  getRefundableComponents,
};