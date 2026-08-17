// src/modules/products/kxtill/db/product.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// PRODUCT CRUD (Organization-level)
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
      branchProducts: {
        include: {
          branch: true,
        },
      },
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
        branchProducts: {
          include: {
            branch: true,
          },
        },
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
      branchProducts: {
        include: {
          branch: true,
        },
      },
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
// BRANCH PRODUCTS (Branch-level inventory)
// ============================================================

const findBranchProduct = async (productId, branchId) => {
  return prisma.kxTillBranchProduct.findUnique({
    where: {
      productId_branchId: {
        productId,
        branchId,
      },
    },
    include: {
      product: {
        include: {
          units: true,
          baseUnit: true,
        },
      },
      branch: true,
    },
  });
};

const getLowStockProducts = async (organizationId) => {
  // Get all branch products with low stock
  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: {
      product: {
        organizationId,
        isActive: true,
        trackInventory: true,
      },
      isAvailable: true,
      stock: {
        lte: prisma.kxTillBranchProduct.fields.minStock,
      },
    },
    include: {
      product: {
        include: {
          baseUnit: true,
        },
      },
      branch: true,
    },
    orderBy: { stock: 'asc' },
  });

  return branchProducts.map((bp) => ({
    id: bp.id,
    productId: bp.productId,
    name: bp.product.name,
    sku: bp.product.sku,
    stock: bp.stock,
    minStock: bp.minStock,
    unit: bp.product.baseUnit?.abbreviation || 'units',
    branchId: bp.branchId,
    branchName: bp.branch.name,
  }));
};

const getBranchProducts = async (branchId, filters = {}) => {
  const { limit = 50, offset = 0, search, category } = filters;
  const where = {
    branchId,
    isAvailable: true,
    product: {
      isActive: true,
    },
  };

  if (search) {
    where.product.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) {
    where.product.category = category;
  }

  const [items, total] = await Promise.all([
    prisma.kxTillBranchProduct.findMany({
      where,
      include: {
        product: {
          include: {
            units: true,
            baseUnit: true,
          },
        },
        branch: true,
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillBranchProduct.count({ where }),
  ]);

  return {
    items: items.map((bp) => ({
      id: bp.id,
      productId: bp.productId,
      name: bp.product.name,
      displayName: bp.displayName,
      sku: bp.product.sku,
      category: bp.product.category,
      price: bp.price,
      stock: bp.stock,
      minStock: bp.minStock,
      isAvailable: bp.isAvailable,
      units: bp.product.units,
      baseUnit: bp.product.baseUnit,
      branchId: bp.branchId,
      branchName: bp.branch.name,
    })),
    total,
    limit,
    offset,
  };
};

const updateBranchProductStock = async (branchProductId, data) => {
  return prisma.kxTillBranchProduct.update({
    where: { id: branchProductId },
    data,
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
  findBranchProduct,
  getLowStockProducts,
  getBranchProducts,
  updateBranchProductStock,
};