// src/modules/products/kxtill/db/sale.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// SALES
// ============================================================

const createSale = async (data) => {
  return prisma.kxTillSale.create({ data });
};

const findSaleById = async (id, organizationId) => {
  return prisma.kxTillSale.findFirst({
    where: { id, organizationId },
    include: {
      items: {
        include: {
          product: true,
          unit: true,
        },
      },
      payments: true,
      user: {
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

const findSalesByOrganization = async (organizationId, filters = {}) => {
  const { limit = 50, offset = 0, startDate, endDate, status } = filters;
  const where = { organizationId };

  if (startDate) where.createdAt = { gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.kxTillSale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
            unit: true,
          },
        },
        payments: true,
        user: {
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
    prisma.kxTillSale.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateSaleStatus = async (id, status) => {
  return prisma.kxTillSale.update({
    where: { id },
    data: { status },
  });
};

// ============================================================
// SALE ITEMS
// ============================================================

const createSaleItem = async (data) => {
  return prisma.kxTillSaleItem.create({ data });
};

const createManySaleItems = async (items) => {
  return prisma.kxTillSaleItem.createMany({ data: items });
};

// ============================================================
// SALE PAYMENTS
// ============================================================

const createSalePayment = async (data) => {
  return prisma.kxTillSalePayment.create({ data });
};

export default {
  createSale,
  findSaleById,
  findSalesByOrganization,
  updateSaleStatus,
  createSaleItem,
  createManySaleItems,
  createSalePayment,
};