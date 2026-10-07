// src/modules/products/kxtill/services/sale.service.js

import saleDb from '../db/sale.db.js';
import productDb from '../db/product.db.js';
import settingDb from '../shift/db/setting.db.js';
import shiftDb from '../shift/db/shift.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';
import creditDb from '../credit/db/credit.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import prisma from '../../../../database/postgres/prisma.js';
import creditService from '../credit/services/credit.service.js';
import refundDb from '../db/refund.db.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// HELPERS
// ============================================================

const generateReference = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `INV-${timestamp}-${random}`;
};

const resolveShiftForSale = async ({ organizationId, userId, branchId, shiftId }) => {
  const branchSetting = await settingDb.findSettingByBranch(branchId);

  if (!branchSetting?.shiftsEnabled) {
    return null;
  }

  if (!shiftId) {
    throw new Error('Shift is required');
  }

  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }
  if (shift.userId !== userId) {
    throw new Error('Shift does not belong to you');
  }
  if (shift.branchId !== branchId) {
    throw new Error('Shift does not match branch');
  }

  return shift.id;
};

// Normalizes `data.payments` (array) or `data.paymentMethod` (legacy single)
// into a canonical array of { method, amount, reference }.
const normalizePayments = (data, totalAmount) => {
  if (Array.isArray(data.payments) && data.payments.length > 0) {
    return data.payments.map((p, i) => {
      if (!p || typeof p.method !== 'string' || !p.method.trim()) {
        throw new Error(`Payment ${i + 1}: method is required`);
      }
      const amount = Number(p.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Payment ${i + 1}: amount must be a positive number`);
      }
      return {
        method: p.method.trim(),
        amount,
        reference: p.reference || null,
      };
    });
  }

  if (data.paymentMethod) {
    return [
      {
        method: data.paymentMethod,
        amount: totalAmount,
        reference: data.paymentReference || null,
      },
    ];
  }

  return [];
};

// Validates that payments fully cover the total.
// PARTIAL status is reserved for the credit ledger module — not yet live.
const resolvePaymentStatus = (payments, totalAmount) => {
  if (payments.length === 0) {
    return { paymentStatus: 'PAID', balance: 0 };
  }

  const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const tolerance = 0.01;

  if (paidTotal > totalAmount + tolerance) {
    const over = (paidTotal - totalAmount).toFixed(2);
    throw new Error(`Payments exceed sale total by ${over}`);
  }

  if (paidTotal < totalAmount - tolerance) {
    const short = (totalAmount - paidTotal).toFixed(2);
    throw new Error(`Payments are short by ${short}. Full payment required.`);
  }

  return { paymentStatus: 'PAID', balance: 0 };
};

// ============================================================
// CREATE SALE (online)
// ============================================================

// Public entry point — opens the transaction, delegates to createSaleTx,
// then performs post-commit side effects (audit + read-back).
const createSale = async (userId, organizationId, data) => {
  const saleId = await prisma.$transaction(
    (tx) => createSaleTx(tx, userId, organizationId, data),
    { maxWait: 5000, timeout: 15000 }
  );

  const sale = await saleDb.findSaleById(saleId, organizationId);

  const creditAmount = (sale.payments || [])
    .filter((p) => p.method === 'CREDIT')
    .reduce((s, p) => s + Number(p.amount), 0);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_CREATED',
    resource: 'sale',
    resourceId: saleId,
    metadata: {
      total: Number(sale.totalAmount),
      items: sale.items?.length ?? 0,
      reference: sale.reference,
      customerId: sale.customerId || null,
      customerName: sale.customerName || 'Walk-in',
      shiftId: sale.shiftId || null,
      payments: (sale.payments || []).map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
      creditAmount,
    },
  });

  return sale;
};

// Transaction-aware core — composable primitive for verticals.
// MUST receive an active Prisma.TransactionClient as `tx`.
// Does NOT open its own transaction. Does NOT use the global prisma client.
// Returns the created sale's id.
const createSaleTx = async (tx, userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.create');
  if (!hasPermission) {
    throw new Error('You do not have permission to create sales');
  }

  const shiftId = await resolveShiftForSale({
    organizationId,
    userId,
    branchId: data.branchId,
    shiftId: data.shiftId,
  });

  let customer = null;
  if (data.customerId) {
    const customerService = await import('../../../platform/customers/index.js');
    customer = await customerService.default.validateCustomer(data.customerId, organizationId);
  }

  // ---- Pre-validate + compute everything BEFORE touching the database ----
  let subtotal = 0;
  let taxAmount = 0;
  const preparedItems = [];

  for (const item of data.items) {
    const product = await productDb.findProductById(item.productId, organizationId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const unit = await productDb.findUnitById(item.unitId, item.productId);
    if (!unit) {
      throw new Error(`Unit ${item.unitId} not found for product ${item.productId}`);
    }

    const quantity = Number(item.quantity);
    const conversionQty = Number(unit.conversionQty);
    const baseQuantity = quantity * conversionQty;
    const unitPrice = Number(unit.price || product.price);

    const branchProduct = await tx.kxTillBranchProduct.findFirst({
      where: {
        productId: product.id,
        branchId: data.branchId,
      },
    });

    if (!branchProduct) {
      throw new Error(`Product ${product.name} is not available at this branch`);
    }

    const trackInventory = !!product.trackInventory;

    if (trackInventory && Number(branchProduct.stock) < baseQuantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${branchProduct.stock} ${product.baseUnit?.abbreviation || 'units'}`
      );
    }

    const total = quantity * unitPrice;
    const tax = total * (Number(product.taxRate) / 100);

    subtotal += total;
    taxAmount += tax;

    preparedItems.push({
      product,
      branchProduct,
      unit,
      quantity,
      conversionQty,
      baseQuantity,
      unitPrice,
      tax,
      total,
      trackInventory,
    });
  }

  const totalAmount = subtotal + taxAmount;
  const reference = generateReference();

  const payments = normalizePayments(data, totalAmount);
  const { paymentStatus } = resolvePaymentStatus(payments, totalAmount);

  // ---- Credit validation ----
  const creditPayments = payments.filter((p) => p.method === 'CREDIT');
  const creditTotal = creditPayments.reduce((s, p) => s + p.amount, 0);
  const hasCredit = creditTotal > 0;

  if (hasCredit) {
    if (!customer) {
      throw new Error('Credit sale requires a customer');
    }

    const branchSetting = await settingDb.findSettingByBranch(data.branchId);
    if (!branchSetting?.creditEnabled) {
      throw new Error('Credit is not enabled for this branch');
    }

    await creditService.checkCreditLimit(customer.id, organizationId, creditTotal);
  }

  const finalPaymentStatus = hasCredit ? 'CREDIT' : paymentStatus;

  // ---- Writes — all use `tx` ----
  const createdSale = await saleDb.createSale(
    {
      organizationId,
      userId,
      reference,
      customerId: customer?.id || null,
      customerName: customer?.name || data.customerName || 'Walk-in',
      branchId: data.branchId,
      shiftId,
      subtotal,
      taxAmount,
      discount: 0,
      totalAmount,
      status: 'COMPLETED',
      paymentStatus: finalPaymentStatus,
    },
    tx
  );

  for (const p of preparedItems) {
    if (p.trackInventory) {
      const result = await tx.kxTillBranchProduct.updateMany({
        where: {
          id: p.branchProduct.id,
          stock: { gte: p.baseQuantity },
        },
        data: { stock: { decrement: p.baseQuantity } },
      });

      if (result.count === 0) {
        throw new Error(`Insufficient stock for ${p.product.name}`);
      }
    }

    await saleDb.createSaleItem(
      {
        saleId: createdSale.id,
        productId: p.product.id,
        unitId: p.unit.id,
        branchProductId: p.branchProduct.id,
        unitName: p.unit.name,
        unitAbbrev: p.unit.abbreviation,
        unitType: p.unit.unitType,
        quantity: p.quantity,
        conversionQty: p.conversionQty,
        unitPrice: p.unitPrice,
        baseQuantity: p.baseQuantity,
        taxRate: Number(p.product.taxRate),
        taxAmount: p.tax,
        discount: 0,
        total: p.total + p.tax,
      },
      tx
    );
  }

  for (const pay of payments) {
    const paymentData = {
      saleId: createdSale.id,
      method: pay.method,
      amount: pay.amount,
      reference: pay.reference,
    };

    if (pay.method === 'CREDIT') {
      const chargeEntry = await creditService.recordCharge(
        {
          organizationId,
          customerId: customer.id,
          branchId: data.branchId,
          saleId: createdSale.id,
          shiftId,
          amount: pay.amount,
          createdById: userId,
        },
        tx
      );
      paymentData.creditLedgerId = chargeEntry.id;
    }

    await saleDb.createSalePayment(paymentData, tx);
  }

  return createdSale.id;
};

// ============================================================
// CREATE SALE (offline sync)
// ============================================================

const createOfflineSale = async (userId, organizationId, data) => {
  const {
    clientSaleId,
    branchId,
    customerId,
    customerName,
    items,
  } = data;

  if (clientSaleId) {
    const existing = await saleDb.findSaleByClientId(clientSaleId);
    if (existing) {
      return saleDb.findSaleById(existing.id, organizationId);
    }
  }

  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) throw new Error('Organization not found');

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) throw new Error('Branch not found');

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.create');
  if (!hasPermission) throw new Error('You do not have permission to create sales');

  const shiftId = await resolveShiftForSale({
    organizationId,
    userId,
    branchId,
    shiftId: data.shiftId,
  });

  let customer = null;
  if (customerId) {
    const customerService = await import('../../../platform/customers/index.js');
    customer = await customerService.default.validateCustomer(customerId, organizationId);
  }

  const reference = generateReference();

  const preparedItems = [];
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of data.items) {
    const product = await productDb.findProductById(item.productId, organizationId);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const branchProduct = await productDb.findBranchProductById(item.branchProductId, organizationId);
    if (!branchProduct) throw new Error(`Branch product ${item.branchProductId} not found`);

    const unit = await productDb.findUnitById(item.unitId, item.productId);
    if (!unit) throw new Error(`Unit ${item.unitId} not found`);

    const quantity = Number(item.quantity);
    const conversionQty = Number(unit.conversionQty);
    const baseQuantity = quantity * conversionQty;
    const unitPrice = Number(item.unitPrice || unit.price || product.price);

    if (product.trackInventory) {
      const stock = Number(branchProduct.stock);
      if (stock < baseQuantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${stock}`);
      }
    }

    const total = quantity * unitPrice;
    const tax = total * (Number(product.taxRate) / 100);

    subtotal += total;
    taxAmount += tax;

    preparedItems.push({
      product,
      branchProduct,
      unit,
      quantity,
      conversionQty,
      baseQuantity,
      unitPrice,
      tax,
      total,
      trackInventory: !!product.trackInventory,
    });
  }

  const totalAmount = subtotal + taxAmount;

  const payments = normalizePayments(data, totalAmount);
  const { paymentStatus } = resolvePaymentStatus(payments, totalAmount);

  // ---- Credit validation ----
  const creditPayments = payments.filter((p) => p.method === 'CREDIT');
  const creditTotal = creditPayments.reduce((s, p) => s + p.amount, 0);
  const hasCredit = creditTotal > 0;

  if (hasCredit) {
    if (!customer) {
      throw new Error('Credit sale requires a customer');
    }

    const branchSetting = await settingDb.findSettingByBranch(branchId);
    if (!branchSetting?.creditEnabled) {
      throw new Error('Credit is not enabled for this branch');
    }

    await creditService.checkCreditLimit(customer.id, organizationId, creditTotal);
  }

  const finalPaymentStatus = hasCredit ? 'CREDIT' : paymentStatus;

  // ---- Idempotency guard #2 ----
  if (clientSaleId) {
    const existing = await saleDb.findSaleByClientId(clientSaleId);
    if (existing) {
      return saleDb.findSaleById(existing.id, organizationId);
    }
  }

  // ---- Create sale + items + payments + ledger inside a transaction ----
  const sale = await prisma.$transaction(
    async (tx) => {
      const createdSale = await saleDb.createSale(
        {
          organizationId,
          userId,
          branchId,
          shiftId,
          clientSaleId: clientSaleId || null,
          customerId: customer?.id || null,
          customerName: customer?.name || customerName || null,
          reference,
          subtotal,
          taxAmount,
          discount: 0,
          totalAmount,
          status: 'COMPLETED',
          paymentStatus: finalPaymentStatus,
        },
        tx
      );

      for (const p of preparedItems) {
        if (p.trackInventory) {
          const result = await tx.kxTillBranchProduct.updateMany({
            where: {
              id: p.branchProduct.id,
              stock: { gte: p.baseQuantity },
            },
            data: { stock: { decrement: p.baseQuantity } },
          });

          if (result.count === 0) {
            throw new Error(`Insufficient stock for ${p.product.name}`);
          }
        }

        await saleDb.createSaleItem(
          {
            saleId: createdSale.id,
            productId: p.product.id,
            unitId: p.unit.id,
            branchProductId: p.branchProduct.id,
            unitName: p.unit.name,
            unitAbbrev: p.unit.abbreviation,
            unitType: p.unit.unitType,
            quantity: p.quantity,
            conversionQty: p.conversionQty,
            unitPrice: p.unitPrice,
            baseQuantity: p.baseQuantity,
            taxRate: Number(p.product.taxRate),
            taxAmount: p.tax,
            discount: 0,
            total: p.total + p.tax,
          },
          tx
        );
      }

      for (const pay of payments) {
        const paymentData = {
          saleId: createdSale.id,
          method: pay.method,
          amount: pay.amount,
          reference: pay.reference,
        };

        if (pay.method === 'CREDIT') {
          const chargeEntry = await creditService.recordCharge(
            {
              organizationId,
              customerId: customer.id,
              branchId,
              saleId: createdSale.id,
              shiftId,
              amount: pay.amount,
              createdById: userId,
            },
            tx
          );
          paymentData.creditLedgerId = chargeEntry.id;
        }

        await saleDb.createSalePayment(paymentData, tx);
      }

      return createdSale;
    },
    { maxWait: 5000, timeout: 15000 }
  );

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_CREATED_OFFLINE',
    resource: 'sale',
    resourceId: sale.id,
    metadata: {
      clientSaleId,
      reference,
      total: totalAmount,
      items: preparedItems.length,
      customerId: customer?.id || null,
      customerName: customer?.name || customerName || null,
      shiftId,
      payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      creditAmount: creditTotal || 0,
    },
  });

  return saleDb.findSaleById(sale.id, organizationId);
};

// ============================================================
// READ
// ============================================================

const getSales = async (organizationId, userId, filters) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return saleDb.findSalesByOrganization(organizationId, filters);
};

const getSale = async (organizationId, userId, saleId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const sale = await saleDb.findSaleById(saleId, organizationId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  return sale;
};

// ============================================================
// REFUNDABLE STATE (for refund UI)
// ============================================================

const getSaleRefundableState = async (organizationId, userId, saleId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const sale = await prisma.kxTillSale.findFirst({
    where: { id: saleId, organizationId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          unit: { select: { id: true, name: true, abbreviation: true } },
        },
      },
      payments: true,
      customer: {
        select: { id: true, name: true, phone: true, creditLimit: true },
      },
      refunds: {
        include: {
          items: { select: { saleItemId: true, quantity: true } },
        },
      },
    },
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  // ---- Per-item refundable ----
  const refundedQtyByItem = {};
  for (const r of sale.refunds) {
    for (const ri of r.items) {
      refundedQtyByItem[ri.saleItemId] =
        (refundedQtyByItem[ri.saleItemId] || 0) + Number(ri.quantity);
    }
  }

  const items = sale.items.map((item) => {
    const originalQty = Number(item.quantity);
    const alreadyRefunded = Number(refundedQtyByItem[item.id] || 0);
    const remainingQty = Math.max(0, originalQty - alreadyRefunded);
    const unitPrice = Number(item.unitPrice);

    return {
      saleItemId: item.id,
      productId: item.productId,
      productName: item.product?.name || 'Unknown',
      sku: item.product?.sku || null,
      unitName: item.unitName,
      unitAbbrev: item.unitAbbrev,
      unitPrice,
      originalQuantity: originalQty,
      alreadyRefundedQuantity: alreadyRefunded,
      remainingQuantity: remainingQty,
      lineRemainingTotal: Number((unitPrice * remainingQty).toFixed(2)),
    };
  });

  // ---- Credit-side cap: how much credit is still refundable ----
  const creditCharged = sale.payments
    .filter((p) => p.method === 'CREDIT')
    .reduce((s, p) => s + Number(p.amount), 0);

  let creditAlreadyReversed = 0;
  for (const r of sale.refunds) {
    creditAlreadyReversed += Number(r.creditAmount);
  }

  const creditRefundable = Math.max(0, creditCharged - creditAlreadyReversed);

  // ---- What the customer originally paid (informational only) ----
  const paymentsSummary = sale.payments.map((p) => ({
    method: p.method,
    amount: Number(p.amount),
    reference: p.reference,
  }));

  // ---- Totals ----
  const saleTotal = Number(sale.totalAmount);
  const refundedAmount = Number(sale.refundedAmount);
  const fullyRefunded = refundedAmount >= saleTotal - 0.01;

  // ---- Customer context ----
  let customerBalance = null;
  if (sale.customerId) {
    customerBalance = await creditDb.sumLedgerForCustomer(
      sale.customerId,
      organizationId
    );
  }

  return {
    sale: {
      id: sale.id,
      reference: sale.reference,
      customerId: sale.customerId,
      customerName: sale.customerName,
      branchId: sale.branchId,
      totalAmount: saleTotal,
      refundedAmount,
      status: sale.status,
      createdAt: sale.createdAt,
    },
    items,
    // Refund method caps — only credit is capped
    creditRefundable,
    // What the customer paid originally (for display only)
    originalPayments: paymentsSummary,
    fullyRefunded,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          creditLimit: sale.customer.creditLimit,
          currentBalance: customerBalance ?? 0,
        }
      : null,
  };
};

// ============================================================
// REFUND (partial + multi-method)
// ============================================================

const generateRefundReference = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `REF-${timestamp}-${random}`;
};

const refundSale = async (organizationId, userId, saleId, payload = {}) => {
  const {
    items: requestedItems,   // [{ saleItemId, quantity }]
    cash = 0,
    mpesa = 0,
    card = 0,
    bank = 0,
    credit = 0,
    reason = null,
    note = null,
    branchId = null,
    shiftId = null,
  } = payload;

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.refund');
  if (!hasPermission) {
    throw new Error('You do not have permission to refund sales');
  }

  const sale = await prisma.kxTillSale.findFirst({
    where: { id: saleId, organizationId },
    include: {
      items: true,
      payments: true,
      refunds: true,
    },
  });

  if (!sale) throw new Error('Sale not found');

  if (branchId && sale.branchId !== branchId) {
    throw new Error('You can only refund sales from your assigned branch');
  }
  if (!branchId && !(membership.hasAllBranches || false)) {
    throw new Error('Branch is required to refund this sale');
  }

  if (sale.status === 'VOIDED') {
    throw new Error('Sale is voided and cannot be refunded');
  }

  const refundShiftId = await resolveShiftForSale({
    organizationId,
    userId,
    branchId: sale.branchId,
    shiftId,
  });

  // ---- Validate items ----
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new Error('At least one item is required for refund');
  }

  const refundedQtyMap = await refundDb.sumRefundedQuantitiesBySale(saleId);

  const refundItems = [];
  let refundTotal = 0;

  for (const req of requestedItems) {
    const saleItem = sale.items.find((i) => i.id === req.saleItemId);
    if (!saleItem) {
      throw new Error(`Sale item ${req.saleItemId} does not belong to this sale`);
    }

    const originalQty = Number(saleItem.quantity);
    const alreadyRefunded = Number(refundedQtyMap[saleItem.id] || 0);
    const remainingQty = Math.max(0, originalQty - alreadyRefunded);

    const reqQty = Number(req.quantity);
    if (!Number.isFinite(reqQty) || reqQty <= 0) {
      throw new Error(`Refund quantity must be positive`);
    }
    if (reqQty > remainingQty + 1e-6) {
      throw new Error(
        `Cannot refund ${reqQty} — only ${remainingQty} remaining on this item`
      );
    }

    const unitPrice = Number(saleItem.unitPrice);
    const lineTotal = unitPrice * reqQty;
    refundTotal += lineTotal;

    refundItems.push({
      saleItemId: saleItem.id,
      quantity: reqQty,
      unitPrice,
      total: lineTotal,
      branchProductId: saleItem.branchProductId,
      baseQuantity: Number(saleItem.conversionQty) * reqQty,
    });
  }

  refundTotal = Number(refundTotal.toFixed(2));
  if (refundTotal <= 0) throw new Error('Refund total must be greater than zero');

  // ---- Refund method breakdown ----
  const cashAmt = Number(cash) || 0;
  const mpesaAmt = Number(mpesa) || 0;
  const cardAmt = Number(card) || 0;
  const bankAmt = Number(bank) || 0;
  const creditAmt = Number(credit) || 0;

  const methodSum = Number(
    (cashAmt + mpesaAmt + cardAmt + bankAmt + creditAmt).toFixed(2)
  );

  if (Math.abs(methodSum - refundTotal) > 0.01) {
    throw new Error(
      `Refund method total (${methodSum.toFixed(2)}) must equal refund total (${refundTotal.toFixed(2)})`
    );
  }

  if (cashAmt < 0 || mpesaAmt < 0 || cardAmt < 0 || bankAmt < 0 || creditAmt < 0) {
    throw new Error('Refund amounts must be non-negative');
  }

  // ---- Credit cap check (server-side, authoritative) ----
  const creditCharged = sale.payments
    .filter((p) => p.method === 'CREDIT')
    .reduce((s, p) => s + Number(p.amount), 0);

  const creditAlreadyReversed = sale.refunds.reduce(
    (s, r) => s + Number(r.creditAmount),
    0
  );

  const creditRefundable = Math.max(0, creditCharged - creditAlreadyReversed);

  if (creditAmt > creditRefundable + 0.01) {
    throw new Error(
      `Credit reversal exceeds refundable credit (${creditRefundable.toFixed(2)})`
    );
  }

  // ---- Map to storage buckets ----
  // cashAmount = physical cash handed back
  // creditAmount = deni reversal
  // otherAmount = electronic refunds (M-PESA, card, bank combined)
  const otherAmt = Number((mpesaAmt + cardAmt + bankAmt).toFixed(2));

  const reference = generateRefundReference();

  // ---- Transaction ----
  const result = await prisma.$transaction(
    async (tx) => {
      const refund = await refundDb.createRefund(
        {
          reference,
          organizationId,
          saleId: sale.id,
          branchId: sale.branchId,
          shiftId: refundShiftId,
          userId,
          totalAmount: refundTotal,
          cashAmount: cashAmt,
          creditAmount: creditAmt,
          otherAmount: otherAmt,
          reason,
          note,
        },
        tx
      );

      for (const ri of refundItems) {
        await refundDb.createRefundItem(
          {
            refundId: refund.id,
            saleItemId: ri.saleItemId,
            quantity: ri.quantity,
            unitPrice: ri.unitPrice,
            total: ri.total,
          },
          tx
        );
      }

      // Restore stock
      for (const ri of refundItems) {
        if (!ri.branchProductId) continue;
        await tx.kxTillBranchProduct.update({
          where: { id: ri.branchProductId },
          data: { stock: { increment: ri.baseQuantity } },
        });
      }

      // Update sale totals + status
      const prevRefunded = Number(sale.refundedAmount);
      const newRefundedAmount = Number((prevRefunded + refundTotal).toFixed(2));
      const saleTotal = Number(sale.totalAmount);
      const fullyRefunded = newRefundedAmount >= saleTotal - 0.01;

      const updatedSale = await tx.kxTillSale.update({
        where: { id: sale.id },
        data: {
          refundedAmount: newRefundedAmount,
          status: fullyRefunded ? 'REFUNDED' : 'REFUNDED_PARTIAL',
          // Legacy dual-write (last-refund snapshot)
          refundedBy: userId,
          refundedAt: new Date(),
          refundShiftId: refundShiftId || sale.refundShiftId || null,
        },
      });

      // Credit reversal (only if credit portion was refunded)
      if (creditAmt > 0.01) {
        const chargeEntries = await tx.customerCreditLedger.findMany({
          where: { saleId: sale.id, type: 'CHARGE' },
          orderBy: { createdAt: 'asc' },
        });

        if (chargeEntries.length === 0) {
          throw new Error(
            'Credit reversal requested but no credit charge exists for this sale'
          );
        }

        await creditService.recordReversal(
          {
            organizationId,
            customerId: sale.customerId,
            saleId: sale.id,
            chargeLedgerEntryId: chargeEntries[0].id,
            amount: creditAmt,
            note: `Refund ${reference}`,
            createdById: userId,
          },
          tx
        );
      }

      return { refund, sale: updatedSale };
    },
    { maxWait: 5000, timeout: 15000 }
  );

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_REFUNDED',
    resource: 'sale',
    resourceId: saleId,
    metadata: {
      refundId: result.refund.id,
      refundReference: reference,
      originalTotal: Number(sale.totalAmount),
      refundTotal,
      methods: { cash: cashAmt, mpesa: mpesaAmt, card: cardAmt, bank: bankAmt, credit: creditAmt },
      itemCount: refundItems.length,
      branchId: sale.branchId,
      shiftId: refundShiftId,
      fullyRefunded: result.sale.status === 'REFUNDED',
    },
  });

  const fullRefund = await refundDb.findRefundById(result.refund.id, organizationId);
  const updatedSaleFull = await saleDb.findSaleById(sale.id, organizationId);

  return {
    refund: fullRefund,
    sale: updatedSaleFull,
    ledgerAffected: creditAmt > 0.01,
    creditReversed: creditAmt,
    customerId: creditAmt > 0.01 ? sale.customerId : null,
  };
};

export default {
  createSale,
  createSaleTx,
  getSales,
  getSale,
  refundSale,
  createOfflineSale,
  getSaleRefundableState,
};