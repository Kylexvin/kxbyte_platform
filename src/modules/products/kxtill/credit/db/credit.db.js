// src/modules/products/kxtill/credit/db/credit.db.js

import prisma from '../../../../../database/postgres/prisma.js';

// ============================================================
// CUSTOMER CREDIT LEDGER
// ============================================================

const createEntry = async (data, tx = prisma) => {
  return tx.customerCreditLedger.create({ data });
};

const findEntryById = async (id, organizationId) => {
  return prisma.customerCreditLedger.findFirst({
    where: { id, organizationId },
    include: {
      customer: {
        select: { id: true, name: true, phone: true, email: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      sale: {
        select: { id: true, reference: true, totalAmount: true },
      },
      shift: {
        select: { id: true, openedAt: true, closedAt: true, status: true },
      },
    },
  });
};

const findEntriesByCustomer = async (customerId, organizationId, filters = {}) => {
  const { limit = 50, offset = 0, type, startDate, endDate } = filters;

  const where = { customerId, organizationId };

  if (type) where.type = type;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [items, total] = await Promise.all([
    prisma.customerCreditLedger.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        sale: {
          select: { id: true, reference: true, totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.customerCreditLedger.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const sumLedgerForCustomer = async (customerId, organizationId, tx = prisma) => {
  const result = await tx.customerCreditLedger.aggregate({
    where: { customerId, organizationId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
};

const findEntriesBySale = async (saleId, tx = prisma) => {
  return tx.customerCreditLedger.findMany({
    where: { saleId },
    orderBy: { createdAt: 'asc' },
  });
};

const findEntriesByShift = async (shiftId, tx = prisma) => {
  return tx.customerCreditLedger.findMany({
    where: { shiftId },
    orderBy: { createdAt: 'asc' },
  });
};

// Sum of PAYMENT-type entries attached to a shift.
// Used by computeExpectedCash: cash repayments land in the drawer.
const sumRepaymentsByShift = async (shiftId, tx = prisma) => {
  const result = await tx.customerCreditLedger.aggregate({
    where: {
      shiftId,
      type: 'PAYMENT',
    },
    _sum: { amount: true },
  });
  // PAYMENT amounts are stored negative, so the sum is negative.
  // Return the absolute value — it represents cash that came in.
  return Math.abs(Number(result._sum.amount || 0));
};

export default {
  createEntry,
  findEntryById,
  findEntriesByCustomer,
  sumLedgerForCustomer,
  findEntriesBySale,
  findEntriesByShift,
  sumRepaymentsByShift,
};