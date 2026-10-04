// src/modules/products/kxtill/db/refund.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// SALE REFUNDS
// ============================================================

const createRefund = async (data, tx = prisma) => {
  return tx.kxTillSaleRefund.create({ data });
};

const findRefundById = async (id, organizationId) => {
  return prisma.kxTillSaleRefund.findFirst({
    where: { id, organizationId },
    include: {
      sale: {
        select: {
          id: true,
          reference: true,
          totalAmount: true,
          refundedAmount: true,
        },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      shift: {
        select: { id: true, openedAt: true, closedAt: true, status: true },
      },
      items: {
        include: {
          saleItem: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
              unit: {
                select: { id: true, name: true, abbreviation: true },
              },
            },
          },
        },
      },
    },
  });
};

const findRefundsBySale = async (saleId, organizationId) => {
  return prisma.kxTillSaleRefund.findMany({
    where: { saleId, organizationId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
      shift: {
        select: { id: true, status: true },
      },
      items: {
        include: {
          saleItem: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
};

const findRefundsByOrganization = async (organizationId, filters = {}) => {
  const {
    limit = 50,
    offset = 0,
    branchId,
    shiftId,
    userId,
    startDate,
    endDate,
  } = filters;

  const where = { organizationId };

  if (branchId) where.branchId = branchId;
  if (shiftId) where.shiftId = shiftId;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [items, total] = await Promise.all([
    prisma.kxTillSaleRefund.findMany({
      where,
      include: {
        sale: {
          select: { id: true, reference: true, customerName: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillSaleRefund.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const createRefundItem = async (data, tx = prisma) => {
  return tx.kxTillSaleRefundItem.create({ data });
};

// Sum of quantities already refunded per sale item, for this sale.
// Returns a map: { saleItemId: totalRefundedQuantity }
const sumRefundedQuantitiesBySale = async (saleId, tx = prisma) => {
  const rows = await tx.kxTillSaleRefundItem.groupBy({
    by: ['saleItemId'],
    where: {
      refund: { saleId },
    },
    _sum: { quantity: true },
  });

  const map = {};
  for (const r of rows) {
    map[r.saleItemId] = Number(r._sum.quantity || 0);
  }
  return map;
};

// Sum of a specific payment-component type refunded for a sale.
// component: 'cash' | 'credit' | 'other'
const sumRefundedByComponent = async (saleId, component, tx = prisma) => {
  const field = `${component}Amount`;
  const result = await tx.kxTillSaleRefund.aggregate({
    where: { saleId },
    _sum: { [field]: true },
  });
  return Number(result._sum[field] || 0);
};

// Total refunded amount across all refund events on a sale.
const sumRefundedTotal = async (saleId, tx = prisma) => {
  const result = await tx.kxTillSaleRefund.aggregate({
    where: { saleId },
    _sum: { totalAmount: true },
  });
  return Number(result._sum.totalAmount || 0);
};

export default {
  createRefund,
  findRefundById,
  findRefundsBySale,
  findRefundsByOrganization,
  createRefundItem,
  sumRefundedQuantitiesBySale,
  sumRefundedByComponent,
  sumRefundedTotal,
};