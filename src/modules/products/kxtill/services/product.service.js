// src/modules/products/kxtill/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

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

  // Create product — taxRate optional, defaults to 0
  const product = await productDb.createProduct({
    organizationId,
    name: data.name,
    sku: data.sku,
    description: data.description,
    category: data.category,
    taxRate: 0,  // ← Always 0
    trackInventory: data.trackInventory !== undefined ? data.trackInventory : true,
    stock: data.stock || 0,
    minStock: data.minStock || 0,
  });

  // Create base unit if provided
  if (data.baseUnit) {
    await productDb.createProductUnit({
      productId: product.id,
      name: data.baseUnit.name,
      abbreviation: data.baseUnit.abbreviation,
      unitType: data.baseUnit.unitType || 'WHOLE',
      conversionQty: 1,
      price: data.baseUnit.price,
      allowFractional: data.baseUnit.allowFractional || false,
      isBaseUnit: true,
    });
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
        allowFractional: unit.allowFractional || false,
        isBaseUnit: false,
      });
    }
  }

  // Set base unit reference
  const units = await productDb.findUnitsByProduct(product.id);
  const baseUnitId = units.find(u => u.isBaseUnit)?.id;
  if (baseUnitId) {
    await productDb.updateProduct(product.id, organizationId, { baseUnitId });
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

  const product = await productDb.updateProduct(productId, organizationId, data);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_UPDATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      name: product.name,
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

  return productDb.getLowStockProducts(organizationId);
};

export default {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
};