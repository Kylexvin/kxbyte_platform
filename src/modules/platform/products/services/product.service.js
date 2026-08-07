// src/modules/platform/products/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../organizations/db/org.db.js';

const listAllProducts = async () => {
  return productDb.findAllProducts();
};

const getProductByKey = async (key) => {
  const product = await productDb.findProductByKey(key);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};

const getOrganizationProducts = async (organizationId, userId) => {
  // Check if user has access to organization
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const orgProducts = await productDb.findOrganizationProducts(organizationId);
  return orgProducts.map((op) => ({
    id: op.id,
    productId: op.productId,
    productKey: op.product.key,
    productName: op.product.name,
    productDescription: op.product.description,
    productLogoUrl: op.product.logoUrl,
    activatedAt: op.activatedAt,
    isActive: op.isActive,
  }));
};

const activateProduct = async (organizationId, userId, productKey) => {
  // Check if user is owner
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can activate products');
  }

  // Check if product exists
  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  // Check if already activated
  const existing = await productDb.findOrganizationProduct(organizationId, product.id);
  if (existing) {
    if (existing.isActive) {
      throw new Error('Product is already activated for this organization');
    }
    // Reactivate if inactive
    return productDb.updateOrganizationProduct(organizationId, product.id, { isActive: true });
  }

  // Activate product
  const orgProduct = await productDb.createOrganizationProduct({
    organizationId,
    productId: product.id,
    activatedAt: new Date(),
    isActive: true,
  });

  // TODO: Call product initialization
  // await product.initialize({ organizationId });

  return {
    organizationId,
    productKey: product.key,
    productName: product.name,
    activatedAt: orgProduct.activatedAt,
    isActive: orgProduct.isActive,
  };
};

const deactivateProduct = async (organizationId, userId, productKey) => {
  // Check if user is owner
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can deactivate products');
  }

  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  const existing = await productDb.findOrganizationProduct(organizationId, product.id);
  if (!existing || !existing.isActive) {
    throw new Error('Product is not activated for this organization');
  }

  await productDb.deactivateOrganizationProduct(organizationId, product.id);

  return {
    organizationId,
    productKey: product.key,
    productName: product.name,
    isActive: false,
  };
};

const getProductActivationStatus = async (organizationId, userId, productKey) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  const orgProduct = await productDb.findOrganizationProduct(organizationId, product.id);

  return {
    organizationId,
    productKey: product.key,
    productName: product.name,
    isActive: !!orgProduct && orgProduct.isActive,
    activatedAt: orgProduct?.activatedAt || null,
  };
};

export default {
  listAllProducts,
  getProductByKey,
  getOrganizationProducts,
  activateProduct,
  deactivateProduct,
  getProductActivationStatus,
};