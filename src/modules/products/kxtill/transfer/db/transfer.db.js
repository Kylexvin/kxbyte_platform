// src/modules/products/kxtill/transfer/db/transfer.db.js

import prisma from '../../../../../database/postgres/prisma.js';

const createTransfer = async (data) => {
  return prisma.kxTillTransfer.create({ data });
};

const findTransferById = async (id, organizationId) => {
  return prisma.kxTillTransfer.findFirst({
    where: { id, organizationId },
    include: {
      sourceBranchProduct: {
        include: {
          branch: true,
          product: true,
        },
      },
      destBranchProduct: {
        include: {
          branch: true,
          product: true,
        },
      },
      initiatedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      rejectedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      completedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

const findTransfersByOrganization = async (organizationId, filters = {}) => {
  const { status, branchId, productId, limit = 50, offset = 0 } = filters;
  const where = { organizationId };

  if (status) where.status = status;
  if (productId) where.productId = productId;
  if (branchId) {
    where.OR = [
      { sourceBranchProduct: { branchId } },
      { destBranchProduct: { branchId } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.kxTillTransfer.findMany({
      where,
      include: {
        sourceBranchProduct: {
          include: {
            branch: true,
            product: true,
          },
        },
        destBranchProduct: {
          include: {
            branch: true,
            product: true,
          },
        },
        initiatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillTransfer.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateTransfer = async (id, data) => {
  return prisma.kxTillTransfer.update({
    where: { id },
    data,
  });
};

const countTransfersByStatus = async (organizationId) => {
  const result = await prisma.kxTillTransfer.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: true,
  });

  const counts = {};
  for (const r of result) {
    counts[r.status] = r._count;
  }
  return counts;
};

export default {
  createTransfer,
  findTransferById,
  findTransfersByOrganization,
  updateTransfer,
  countTransfersByStatus,
};