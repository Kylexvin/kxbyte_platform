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
  const { limit = 50, offset = 0, search, category, includeArchived } = filters;

  const where = { organizationId };

  if (!includeArchived) {
    where.isActive = true;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { units: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
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

const findBranchProductById = async (id, organizationId) => {
  return prisma.kxTillBranchProduct.findFirst({
    where: { id, product: { organizationId } },
    include: {
      product: true,
      branch: true,
    },
  });
};

const findBranchProductsByBranch = async (branchId, organizationId) => {
  return prisma.kxTillBranchProduct.findMany({
    where: {
      branchId,
      product: { organizationId },
      isAvailable: true,
    },
    include: {
      product: true,
    },
  });
};

const getLowStockProducts = async (organizationId) => {
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
  const { limit = 50, offset = 0, search, category, includeUnavailable } = filters;

  // Build the product-level where clause. We iterate PRODUCTS (not branch
  // products) so a branch sees the global catalog even before it has a
  // branch_products row. Products with no row appear with stock 0.
  const productWhere = { isActive: true };
  if (search) {
    productWhere.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { units: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (category) productWhere.category = category;

  // When the caller doesn't want unavailable items, we still need to
  // include products with NO branch row (they're implicitly available).
  // So we don't filter at the product level on availability — we filter
  // after mapping.
  const products = await prisma.kxTillProduct.findMany({
    where: {
      ...productWhere,
      branchProducts: { some: { branchId } },
    },
    include: {
      units: true,
      baseUnit: true,
      branchProducts: {
        where: { branchId },
        include: { branch: true },
      },
    },
    orderBy: { name: 'asc' },
    skip: offset,
    take: limit,
  });

  // Second query: products with no branch row for this branch.
  // Only run when we still have room in the page and caller allows it.
  // (includeUnavailable doesn't apply — these are available-by-default.)
  let orphanProducts = [];
  if (products.length < limit) {
    const remaining = limit - products.length;
    orphanProducts = await prisma.kxTillProduct.findMany({
      where: {
        ...productWhere,
        branchProducts: { none: { branchId } },
      },
      include: {
        units: true,
        baseUnit: true,
      },
      orderBy: { name: 'asc' },
      take: remaining,
    });
  }

  const mapWithRow = (p) => {
    const bp = p.branchProducts[0];
    return {
      id: bp?.id || `bp:${p.id}:${branchId}`,
      productId: p.id,
      name: p.name,
      displayName: bp?.displayName || p.name,
      sku: p.sku,
      category: p.category,
      price: p.baseUnit?.price ?? 0,
      stock: bp?.stock ?? 0,
      minStock: bp?.minStock ?? 0,
      isAvailable: bp?.isAvailable ?? true,
      units: p.units,
      baseUnit: p.baseUnit,
      branchId,
      branchName: bp?.branch?.name || 'Unknown',
    };
  };

  const mapOrphan = (p) => ({
    id: `bp:${p.id}:${branchId}`,
    productId: p.id,
    name: p.name,
    displayName: p.name,
    sku: p.sku,
    category: p.category,
    price: p.baseUnit?.price ?? 0,
    stock: 0,
    minStock: 0,
    isAvailable: true,
    units: p.units,
    baseUnit: p.baseUnit,
    branchId,
    branchName: 'Unknown',
  });

  let items = [
    ...products.map(mapWithRow),
    ...orphanProducts.map(mapOrphan),
  ];

  // Post-filter on availability for products that DO have a row.
  // Products with no row are always available, so they survive.
  if (!includeUnavailable) {
    items = items.filter((it) => it.isAvailable !== false);
  }

  // Re-sort merged results by name (two queries can interleave).
  items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const total = await prisma.kxTillProduct.count({
    where: { ...productWhere, branchProducts: { none: { branchId } } },
  }) + await prisma.kxTillProduct.count({
    where: { ...productWhere, branchProducts: { some: { branchId } } },
  });

  return { items, total, limit, offset };
};

const updateBranchProductStock = async (branchProductId, data) => {
  return prisma.kxTillBranchProduct.update({
    where: { id: branchProductId },
    data,
  });
};

const updateStock = async (branchProductId, quantity) => {
  return prisma.kxTillBranchProduct.update({
    where: { id: branchProductId },
    data: {
      stock: {
        increment: quantity,
      },
    },
  });
};

const findProductByBarcode = async (barcode, organizationId, branchId) => {
  const unit = await prisma.kxTillProductUnit.findFirst({
    where: {
      barcode: barcode,
      product: {
        organizationId,
        isActive: true,
      },
    },
    include: {
      product: {
        include: {
          baseUnit: true,
          units: true,
          branchProducts: {
            where: branchId ? { branchId } : {},
            include: {
              branch: true,
            },
          },
        },
      },
    },
  });

  if (!unit) {
    return null;
  }

  return unit.product;
};

const findBranchProductsForSync = async (organizationId, branchId, since) => {
  const where = {
    branchId,
    
    product: {
      organizationId,
    },
  };

  if (since) {
    where.updatedAt = { gte: new Date(since) };
  }

  return prisma.kxTillBranchProduct.findMany({
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
    orderBy: { updatedAt: 'asc' },
  });
};

const findProductsForSync = async (organizationId, since, limit, offset, branchId) => {
  const where = {
    organizationId,
    isActive: true,
  };

  if (since) {
    where.updatedAt = { gte: new Date(since) };
  }

  const products = await prisma.kxTillProduct.findMany({
    where,
    include: {
      units: true,
      baseUnit: true,
      branchProducts: branchId
        ? { where: { branchId }, include: { branch: true } }
        : false,
    },
    orderBy: { updatedAt: 'asc' },
    skip: offset,
    take: limit,
  });

  const items = products.map((product) => {
    const bp = product.branchProducts?.[0] || null;
    return {
      id: bp?.id || `bp:${product.id}:${branchId}`,
      productId: product.id,
      name: product.name,
      displayName: bp?.displayName || product.name,
      sku: product.sku,
      category: product.category,
      stock: bp?.stock ?? 0,
      minStock: bp?.minStock ?? 0,
      isAvailable: bp?.isAvailable ?? true,
      units: product.units,
      baseUnit: product.baseUnit,
      branchId,
      branchName: bp?.branch?.name || 'Unknown',
      updatedAt: bp?.updatedAt || product.updatedAt,
    };
  });

  const total = await prisma.kxTillProduct.count({ where });
  return { items, total, limit, offset };
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
  findBranchProductById,
  findBranchProductsByBranch,
  getLowStockProducts,
  getBranchProducts,
  updateBranchProductStock,
  updateStock,
  findProductByBarcode,
  findProductsForSync,
  findBranchProductsForSync,
};