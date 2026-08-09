// src/modules/products/kxtill/db/product.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// PRODUCT CRUD
// ============================================================

const createProduct = async (data) => {
  return prisma.kxTillProduct.create({ data });
};

const findProductById = async (id, organizationId) => {
  return prisma.kxTillProduct.findFirst({
    where: { id, organizationId, isActive: true },
    include: {
      units: true,
      baseUnit: true,
    },
  });
};

const findProductsByOrganization = async (organizationId, filters = {}) => {
  const { limit = 50, offset = 0, search, category } = filters;
  const where = { organizationId, isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  const [items, total] = await Promise.all([
    prisma.kxTillProduct.findMany({
      where,
      include: {
        units: true,
        baseUnit: true,
      },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillProduct.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateProduct = async (id, organizationId, data) => {
  return prisma.kxTillProduct.update({
    where: { id },
    data,
    include: {
      units: true,
      baseUnit: true,
    },
  });
};

const deleteProduct = async (id, organizationId) => {
  return prisma.kxTillProduct.update({
    where: { id },
    data: { isActive: false },
  });
};

// ============================================================
// PRODUCT UNITS
// ============================================================

const createProductUnit = async (data) => {
  return prisma.kxTillProductUnit.create({ data });
};

const findUnitById = async (id, productId) => {
  return prisma.kxTillProductUnit.findFirst({
    where: { id, productId, isActive: true },
  });
};

const findUnitsByProduct = async (productId) => {
  return prisma.kxTillProductUnit.findMany({
    where: { productId, isActive: true },
    orderBy: { conversionQty: 'asc' },
  });
};

const updateProductUnit = async (id, data) => {
  return prisma.kxTillProductUnit.update({
    where: { id },
    data,
  });
};

const deleteProductUnit = async (id) => {
  return prisma.kxTillProductUnit.update({
    where: { id },
    data: { isActive: false },
  });
};

// ============================================================
// STOCK
// ============================================================

const updateStock = async (productId, quantity) => {
  return prisma.kxTillProduct.update({
    where: { id: productId },
    data: {
      stock: {
        increment: quantity,
      },
    },
  });
};

const getLowStockProducts = async (organizationId) => {
  return prisma.kxTillProduct.findMany({
    where: {
      organizationId,
      isActive: true,
      trackInventory: true,
      stock: {
        lte: prisma.kxTillProduct.fields.minStock,
      },
    },
    include: {
      baseUnit: true,
    },
    orderBy: { stock: 'asc' },
  });
};

export default {
  createProduct,
  findProductById,
  findProductsByOrganization,
  updateProduct,
  deleteProduct,
  createProductUnit,
  findUnitById,
  findUnitsByProduct,
  updateProductUnit,
  deleteProductUnit,
  updateStock,
  getLowStockProducts,
};