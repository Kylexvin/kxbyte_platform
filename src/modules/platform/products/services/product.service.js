// src/modules/platform/products/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../organizations/db/org.db.js';
import planDb from '../../subscriptions/db/plan.db.js';
import subscriptionService from '../../subscriptions/services/subscription.service.js';
import audit from '../../audit/index.js';

const createSubscriptionForProduct = async (organizationId, productKey) => {
  try {
    const plans = await planDb.findPlansByProduct(productKey);
    if (plans && plans.length > 0) {
      const defaultPlan = plans.find((p) => p.key === 'professional') || plans[0];
      await subscriptionService.createSubscription(
        organizationId,
        productKey,
        defaultPlan.key
      );
      console.log(`✅ Subscription created for ${productKey} (${defaultPlan.name})`);
    } else {
      console.log(`⚠️ No plans found for ${productKey}, subscription not created`);
    }
  } catch (error) {
    if (error.message === 'Subscription already exists for this product') {
      console.log(`ℹ️ Subscription already exists for ${productKey}`);
    } else {
      console.error(`Failed to create subscription for ${productKey}:`, error.message);
    }
  }
};

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
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can activate products');
  }

  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  const existing = await productDb.findOrganizationProduct(organizationId, product.id);

  let result;

  // Handle reactivation
  if (existing) {
    if (existing.isActive) {
      throw new Error('Product is already activated for this organization');
    }
    // Reactivate
    await productDb.updateOrganizationProduct(organizationId, product.id, { isActive: true });

    // Create subscription on reactivation
    await createSubscriptionForProduct(organizationId, productKey);

    result = {
      organizationId,
      productKey: product.key,
      productName: product.name,
      activatedAt: new Date(),
      isActive: true,
    };
  } else {
    // New activation
    const orgProduct = await productDb.createOrganizationProduct({
      organizationId,
      productId: product.id,
      activatedAt: new Date(),
      isActive: true,
    });

    // Create subscription
    await createSubscriptionForProduct(organizationId, productKey);

    result = {
      organizationId,
      productKey: product.key,
      productName: product.name,
      activatedAt: orgProduct.activatedAt,
      isActive: orgProduct.isActive,
    };
  }

  // Audit log: Product activated
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'PRODUCT_ACTIVATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      productKey: product.key,
      productName: product.name,
    },
  });

  return result;
};

const deactivateProduct = async (organizationId, userId, productKey) => {
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

  // Audit log: Product deactivated
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'PRODUCT_DEACTIVATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      productKey: product.key,
      productName: product.name,
    },
  });

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