// src/modules/platform/products/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../organizations/db/org.db.js';
import planDb from '../../subscriptions/db/plan.db.js';
import subscriptionDb from '../../subscriptions/db/subscription.db.js';
import subscriptionService from '../../subscriptions/services/subscription.service.js';
import audit from '../../audit/index.js';
import { addDays } from 'date-fns';

const createSubscriptionForProduct = async (organizationId, productKey) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const plans = await planDb.findPlansByProduct(productKey);
  if (!plans || plans.length === 0) {
    throw new Error(`No active plans registered for product ${productKey}`);
  }

  // Plans come ordered by price ASC. First active plan is the default.
  const defaultPlan = plans[0];

  const trialBurned = await subscriptionService.isTrialBurned(
    organization.ownerId,
    productKey
  );

  if (trialBurned) {
    try {
      await subscriptionService.createSubscriptionWithoutTrial(
        organizationId,
        productKey,
        defaultPlan.key
      );
      console.log(
        `Subscription created for ${productKey} (NO TRIAL — owner already burned trial, plan=${defaultPlan.key})`
      );
    } catch (error) {
      if (error.message === 'Subscription already exists for this product') {
        console.log(`Subscription already exists for ${productKey}`);
        return;
      }
      throw error;
    }
    return;
  }

  // First-ever activation for this owner+product: grant the trial.
  try {
    await subscriptionService.createSubscription(
      organizationId,
      productKey,
      defaultPlan.key
    );
    console.log(
      `Subscription created for ${productKey} (TRIAL, plan=${defaultPlan.key}, trialDays=${defaultPlan.trialDays})`
    );

    await subscriptionService.markTrialBurned(
      organization.ownerId,
      productKey,
      organizationId
    );
    console.log(`Trial burned for owner ${organization.ownerId} on ${productKey}`);
  } catch (error) {
    if (error.message === 'Subscription already exists for this product') {
      console.log(`Subscription already exists for ${productKey}`);
      return;
    }
    throw error;
  }
};

const reactivateSubscription = async (organizationId, productKey) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);

  if (!subscription) {
    await createSubscriptionForProduct(organizationId, productKey);
    return;
  }

  if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
    const organization = await orgDb.findOrganizationById(organizationId);
    const trialBurned = await subscriptionService.isTrialBurned(
      organization.ownerId,
      productKey
    );

    if (trialBurned) {
      // No trial. Force EXPIRED so they must pay to reactivate.
      await subscriptionDb.updateSubscription(subscription.id, {
        status: 'EXPIRED',
        expiredAt: new Date(),
        trialStart: null,
        trialEnd: null,
        cancelledAt: null,
      });
      console.log(`Subscription reactivated as EXPIRED for ${productKey} (no trial — burned)`);
      return;
    }

    // Should not happen — trial burn is always written on first activation.
    // Defensive: treat as no-trial.
    await subscriptionDb.updateSubscription(subscription.id, {
      status: 'EXPIRED',
      expiredAt: new Date(),
      trialStart: null,
      trialEnd: null,
      cancelledAt: null,
    });
    console.log(`Subscription reactivated as EXPIRED for ${productKey} (trial missing, defensive)`);
  }
};

const listAllProducts = async () => {
  const products = await productDb.findAllProducts();
  return products.filter((p) => p.key !== 'admin');
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

  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  // Check if already activated - skip owner check if active
  const existing = await productDb.findOrganizationProduct(organizationId, product.id);
  
  if (existing && existing.isActive) {
    // Already active - return existing for any user
    return {
      organizationId,
      productKey: product.key,
      productName: product.name,
      activatedAt: existing.activatedAt,
      isActive: true,
    };
  }

  // Only owner can activate if not already active
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can activate products');
  }

  let result;

  if (existing) {
    // Reactivate (existing but inactive)
    await productDb.updateOrganizationProduct(organizationId, product.id, { isActive: true });
    await reactivateSubscription(organizationId, productKey);

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

  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (subscription && subscription.status !== 'CANCELLED') {
    await subscriptionDb.updateSubscription(subscription.id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    });
    console.log(`Subscription cancelled for ${productKey}`);
  }

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