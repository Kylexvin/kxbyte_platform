// src/modules/products/kxtill/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// HELPER: Check permission
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// PRODUCT SERVICE
// ============================================================

const createProduct = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.create');
  if (!hasPermission) {
    throw new Error('You do not have permission to create products');
  }

  // Create product WITH cost
  const product = await productDb.createProduct({
    organizationId,
    name: data.name,
    sku: data.sku,
    description: data.description,
    category: data.category,
    taxRate: 0,
    cost: data.cost || 0,
    trackInventory: data.trackInventory !== undefined ? data.trackInventory : true,
  });

  let baseUnitId = null;

  // Create base unit if provided
  if (data.baseUnit) {
    const baseUnit = await productDb.createProductUnit({
      productId: product.id,
      name: data.baseUnit.name,
      abbreviation: data.baseUnit.abbreviation,
      unitType: data.baseUnit.unitType || 'WHOLE',
      conversionQty: 1,
      price: data.baseUnit.price,
      cost: data.baseUnit.cost || null,
      allowFractional: data.baseUnit.allowFractional || false,
    });
    baseUnitId = baseUnit.id;
  }

  // Create selling units
  if (data.units && data.units.length > 0) {
    for (const unit of data.units) {
      await productDb.createProductUnit({
        productId: product.id,
        name: unit.name,
        abbreviation: unit.abbreviation,
        unitType: unit.unitType || 'PACKAGED',
        conversionQty: unit.conversionQty || 1,
        price: unit.price,
        cost: unit.cost || null,
        allowFractional: unit.allowFractional || false,
      });
    }
  }

  // Set base unit reference
  if (baseUnitId) {
    await productDb.updateProduct(product.id, organizationId, { baseUnitId });
  }

  // Create branch products for all active branches
  const branches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
  });

  for (const branch of branches) {
    await prisma.kxTillBranchProduct.create({
      data: {
        productId: product.id,
        branchId: branch.id,
        displayName: data.name,
        stock: data.stock || 0,
        minStock: data.minStock || 0,
        isAvailable: true,
      },
    });
  }

  const completeProduct = await productDb.findProductById(product.id, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_CREATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      name: product.name,
      sku: product.sku,
    },
  });

  return completeProduct;
};

const getProducts = async (organizationId, userId, filters) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return productDb.findProductsByOrganization(organizationId, filters);
};

const getProduct = async (organizationId, userId, productId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const product = await productDb.findProductById(productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }

  return product;
};

const updateProduct = async (organizationId, userId, productId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  // ✅ Only allow valid product fields
  const allowedFields = ['name', 'sku', 'description', 'category', 'taxRate', 'cost', 'trackInventory', 'isActive'];
  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const product = await productDb.updateProduct(productId, organizationId, updateData);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_UPDATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      name: product.name,
      updatedFields: Object.keys(updateData),
    },
  });

  return product;
};

const deleteProduct = async (organizationId, userId, productId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.delete');
  if (!hasPermission) {
    throw new Error('You do not have permission to delete products');
  }

  const product = await productDb.deleteProduct(productId, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_DELETED',
    resource: 'product',
    resourceId: productId,
    metadata: {
      name: product.name,
    },
  });

  return product;
};

const getLowStockProducts = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view inventory');
  }

  return productDb.getLowStockProducts(organizationId);
};

const getProductByBarcode = async (organizationId, userId, barcode, branchId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const product = await productDb.findProductByBarcode(barcode, organizationId, branchId);
  if (!product) {
    throw new Error('Product not found');
  }

  let branchStock = null;
  if (branchId && product.branchProducts && product.branchProducts.length > 0) {
    const bp = product.branchProducts[0];
    branchStock = {
      stock: bp.stock,
      minStock: bp.minStock,
      isAvailable: bp.isAvailable,
    };
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    price: product.price,
    taxRate: product.taxRate,
    baseUnit: product.baseUnit,
    units: product.units,
    stock: branchStock?.stock || 0,
    isAvailable: branchStock?.isAvailable !== false,
  };
};

const searchProducts = async (organizationId, userId, searchTerm, branchId, limit = 20) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const products = await prisma.kxTillProduct.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
       
      ],
    },
    include: {
      units: true,
      baseUnit: true,
      branchProducts: {
        where: { branchId },
        include: {
          branch: true,
        },
      },
    },
    take: limit,
  });

  return products.map((product) => {
    const branchProduct = product.branchProducts?.[0];
    return {
      id: product.id,
      productId: product.id,
      name: product.name,
      displayName: branchProduct?.displayName || product.name,
      sku: product.sku,
      category: product.category,
      stock: branchProduct?.stock || 0,
      minStock: branchProduct?.minStock || 0,
      isAvailable: branchProduct?.isAvailable !== false,
      price: branchProduct?.price || product.price,
      baseUnit: product.baseUnit,
      units: product.units,
      branchId: branchId,
      branchName: branchProduct?.branch?.name,
    };
  });
};




// ============================================================
// BRANCH PRODUCTS
// ============================================================

const updateBranchProduct = async (organizationId, userId, branchId, productId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  if (!membership.hasAllBranches) {
    const hasBranchAccess = await prisma.branchAssignment.findUnique({
      where: {
        membershipId_branchId: {
          membershipId: membership.id,
          branchId,
        },
      },
    });
    if (!hasBranchAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  const branchProduct = await prisma.kxTillBranchProduct.findFirst({
    where: {
      productId,
      branchId,
      product: { organizationId },
    },
  });

  if (!branchProduct) {
    throw new Error('Branch product not found');
  }

  // ✅ Remove price from update
  const updated = await prisma.kxTillBranchProduct.update({
    where: { id: branchProduct.id },
    data: {
      displayName: data.displayName !== undefined ? data.displayName : branchProduct.displayName,
      description: data.description !== undefined ? data.description : branchProduct.description,
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : branchProduct.isAvailable,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_BRANCH_PRODUCT_UPDATED',
    resource: 'branch_product',
    resourceId: updated.id,
    metadata: {
      productId,
      branchId,
      updatedFields: Object.keys(data),
    },
  });

  return updated;
};

const getBranchProducts = async (organizationId, userId, branchId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Check if user has access to this branch
  if (!membership.hasAllBranches) {
    const hasBranchAccess = await prisma.branchAssignment.findUnique({
      where: {
        membershipId_branchId: {
          membershipId: membership.id,
          branchId,
        },
      },
    });
    if (!hasBranchAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  return productDb.getBranchProducts(branchId, filters);
};

const updateBranchProductStock = async (organizationId, userId, branchId, productId, stockData) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update inventory');
  }

  const branchProduct = await prisma.kxTillBranchProduct.findFirst({
    where: {
      productId,
      branchId,
      product: {
        organizationId,
      },
    },
  });

  if (!branchProduct) {
    throw new Error('Branch product not found');
  }

  const updated = await prisma.kxTillBranchProduct.update({
    where: { id: branchProduct.id },
    data: {
      stock: stockData.stock,
      minStock: stockData.minStock !== undefined ? stockData.minStock : branchProduct.minStock,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_BRANCH_STOCK_UPDATED',
    resource: 'branch_product',
    resourceId: branchProduct.id,
    metadata: {
      productId,
      branchId,
      oldStock: branchProduct.stock,
      newStock: stockData.stock,
    },
  });

  return updated;
};



const updateProductUnit = async (organizationId, userId, productId, unitId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  const product = await productDb.findProductById(productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }

  const unit = await productDb.findUnitById(unitId, productId);
  if (!unit) {
    throw new Error('Unit not found');
  }

  const updated = await productDb.updateProductUnit(unitId, {
    barcode: data.barcode,
    price: data.price,
    allowFractional: data.allowFractional,
    conversionQty: data.conversionQty,
  });

  return updated;
};

const getProductsForSync = async (organizationId, since, limit = 50, offset = 0, branchId) => {
  const result = await productDb.findProductsForSync(organizationId, since, limit, offset, branchId);
  
  // result is already flattened with { items, total, limit, offset }
  return result;
};

const getBranchProductsForSync = async (organizationId, branchId, since, limit = 50, offset = 0) => {
  const where = {
    branchId,
    isAvailable: true,
    product: {
      organizationId,
    },
  };

  if (since) {
    where.updatedAt = { gte: new Date(since) };
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
      orderBy: { updatedAt: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillBranchProduct.count({ where }),
  ]);

  // Format items consistently
  const formattedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product?.name || 'Unknown',
    displayName: item.displayName || item.product?.name || 'Unknown',
    sku: item.product?.sku || null,
    category: item.product?.category || null,
    stock: item.stock,
    minStock: item.minStock,
    isAvailable: item.isAvailable,
    units: item.product?.units || [],
    baseUnit: item.product?.baseUnit || null,
    branchId: item.branchId,
    branchName: item.branch?.name || 'Unknown',
    updatedAt: item.updatedAt,
  }));

  return { items: formattedItems, total, limit, offset };
};

export default {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getBranchProducts,
  updateBranchProductStock,
  getProductByBarcode,
  searchProducts,
  updateProductUnit,
  getProductsForSync,
  getBranchProductsForSync,
  updateBranchProduct,
};