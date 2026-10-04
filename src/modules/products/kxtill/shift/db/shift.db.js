// src/modules/products/kxtill/shift/db/shift.db.js

import prisma from '../../../../../database/postgres/prisma.js';

// ============================================================
// SHIFTS
// ============================================================

const createShift = async (data) => {
  return prisma.kxTillShift.create({ data });
};

const findShiftById = async (id, organizationId) => {
  return prisma.kxTillShift.findFirst({
    where: { id, organizationId },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      openedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      closedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      handoverRequestedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      handoverResolvedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      varianceReviewedBy: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      sales: {
        select: {
          id: true,
          reference: true,
          totalAmount: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
      refunds: {
        select: {
          id: true,
          reference: true,
          totalAmount: true,
          refundedAt: true,
        },
      },
    },
  });
};

const findOpenShiftByUser = async (userId, organizationId) => {
  return prisma.kxTillShift.findFirst({
    where: {
      userId,
      organizationId,
      status: 'OPEN',
      deletedAt: null,
    },
  });
};

const findOpenShiftByBranch = async (branchId, tillId = null) => {
  const where = {
    branchId,
    status: 'OPEN',
    deletedAt: null,
  };
  if (tillId) {
    where.tillId = tillId;
  }
  return prisma.kxTillShift.findFirst({ where });
};

const findShiftsByOrganization = async (organizationId, filters = {}) => {
  const {
    limit = 50,
    offset = 0,
    branchId,
    userId,
    status,
    startDate,
    endDate,
    includeDeleted = false,
  } = filters;

  const where = { organizationId };

  if (!includeDeleted) {
    where.deletedAt = null;
  }
  if (branchId) where.branchId = branchId;
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.openedAt = {};
    if (startDate) where.openedAt.gte = new Date(startDate);
    if (endDate) where.openedAt.lte = new Date(endDate);
  }

  const [items, total] = await Promise.all([
    prisma.kxTillShift.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        branch: {
          select: { id: true, name: true, code: true },
        },
        closedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { sales: true, refunds: true },
        },
      },
      orderBy: { openedAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillShift.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const findPendingReviewShifts = async (organizationId) => {
  return prisma.kxTillShift.findMany({
    where: {
      organizationId,
      status: 'CLOSED_PENDING_REVIEW',
      deletedAt: null,
    },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      closedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { closedAt: 'desc' },
  });
};

const updateShift = async (id, data) => {
  return prisma.kxTillShift.update({
    where: { id },
    data,
  });
};

const closeShift = async (id, data) => {
  return prisma.kxTillShift.update({
    where: { id },
    data: {
      status: data.status,
      closureType: data.closureType,
      declaredCash: data.declaredCash,
      expectedCash: data.expectedCash,
      variance: data.variance,
      closedById: data.closedById,
      closedAt: new Date(),
    },
  });
};

const cancelShift = async (id) => {
  return prisma.kxTillShift.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      closureType: 'CANCELLED',
      deletedAt: new Date(),
    },
  });
};

// Aggregate cash payments attached to a shift
const sumCashPaymentsByShift = async (shiftId) => {
  const result = await prisma.kxTillSalePayment.aggregate({
    where: {
      method: 'CASH',
      sale: {
        shiftId,
        status: { not: 'REFUNDED' },
      },
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
};

// Aggregate cash refunds charged against a shift
const sumCashRefundsByShift = async (shiftId) => {
  const result = await prisma.kxTillSaleRefund.aggregate({
    where: { shiftId },
    _sum: { cashAmount: true },
  });
  return Number(result._sum.cashAmount || 0);
};

// Count non-deleted sales attached to a shift (used by cancelShift guard)
const countSalesByShift = async (shiftId) => {
  return prisma.kxTillSale.count({
    where: {
      OR: [{ shiftId }, { refundShiftId: shiftId }],
    },
  });
};

export default {
  createShift,
  findShiftById,
  findOpenShiftByUser,
  findOpenShiftByBranch,
  findShiftsByOrganization,
  findPendingReviewShifts,
  updateShift,
  closeShift,
  cancelShift,
  sumCashPaymentsByShift,
  sumCashRefundsByShift,
  countSalesByShift,
};