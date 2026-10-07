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
    instances: (op.instances || []).map((i) => ({
      id: i.id,
      vertical: i.vertical,
      name: i.name,
      isActive: i.isActive,
    })),
  }));
};

const activateProduct = async (organizationId, userId, productKey, vertical = 'retail') => {
  if (productKey === 'admin') {
    throw new Error('Cannot activate internal platform product');
  }

  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const product = await productDb.findProductByKey(productKey);
  if (!product) {
    throw new Error('Product not found');
  }

  const existing = await productDb.findOrganizationProduct(organizationId, product.id);

  // Helper: build the enriched response
  const buildResponse = async () => {
    const subscription = await subscriptionDb.findSubscription(organizationId, productKey);

    // Fetch instances for this activation (may be empty if legacy org not yet backfilled)
    let instances = [];
    if (existing) {
      const rows = await productDb.findInstancesByOrganizationProduct(existing.id);
      instances = rows.map((i) => ({
        id: i.id,
        vertical: i.vertical,
        name: i.name,
        isActive: i.isActive,
      }));
    }

    return {
      organizationId,
      productKey: product.key,
      productName: product.name,
      activatedAt: existing?.activatedAt || new Date(),
      isActive: true,
      subscriptionStatus: subscription?.status || null,
      trialEnd: subscription?.trialEnd || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      remainingDays: subscription
        ? Math.max(
            0,
            Math.ceil(
              (new Date(
                subscription.status === 'TRIAL'
                  ? subscription.trialEnd
                  : subscription.status === 'GRACE'
                  ? subscription.graceEnd
                  : subscription.currentPeriodEnd
              ).getTime() - Date.now()) / 86400000
            )
          )
        : null,
      instances,
    };
  };

  // Already active — return for any user
  // Already active — return for any user, but allow adding a new vertical instance
  if (existing && existing.isActive) {
    const instances = await productDb.findInstancesByOrganizationProduct(existing.id);
    const hasVertical = instances.some((i) => i.vertical === vertical);

    if (!hasVertical) {
      const instanceName = `${organization.name} ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}`;
      const instance = await productDb.createProductInstance({
        organizationProductId: existing.id,
        vertical,
        name: instanceName,
        isActive: true,
      });
      console.log(`[products] Added ${vertical} instance to existing activation: ${instance.id}`);

      if (vertical === 'pharmacy') {
        await productDb.createPharmacyConfig({
          productInstanceId: instance.id,
          isEnabled: true,
          expiryWarningDays: 90,
          blockExpiredSales: true,
          requireBatchOnSale: true,
        });
        console.log(`[products] Created pharmacy config for instance ${instance.id}`);
      }

      await audit.log({
        organizationId: organization.id,
        userId,
        action: 'PRODUCT_INSTANCE_ADDED',
        resource: 'product_instance',
        resourceId: instance.id,
        metadata: { productKey, vertical },
      });
    }

    return await buildResponse();
  }

  // Only owner can activate if not already active
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can activate products');
  }

  if (existing) {
    // ─── Reactivate path ───
    await productDb.updateOrganizationProduct(organizationId, product.id, { isActive: true });
    await reactivateSubscription(organizationId, productKey);

    // Backfill: if this activation has no instances yet, create a retail one.
    // This covers legacy orgs that activated kxtill before ProductInstance existed.
    const instances = await productDb.findInstancesByOrganizationProduct(existing.id);
    if (instances.length === 0) {
      const defaultName = `${organization.name} Retail`;
      const alreadyExists = await productDb.findInstance(existing.id, 'retail', defaultName);
      if (!alreadyExists) {
        await productDb.createProductInstance({
          organizationProductId: existing.id,
          vertical: 'retail',
          name: defaultName,
          isActive: true,
        });
        console.log(`[products] Backfilled retail instance for org ${organizationId}`);
      }
    }
  } else {
    // ─── New activation path ───
    const orgProduct = await productDb.createOrganizationProduct({
      organizationId,
      productId: product.id,
      activatedAt: new Date(),
      isActive: true,
    });
    await createSubscriptionForProduct(organizationId, productKey);

    // Create the vertical instance
    const instanceName = `${organization.name} ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}`;
    const instance = await productDb.createProductInstance({
      organizationProductId: orgProduct.id,
      vertical,
      name: instanceName,
      isActive: true,
    });
    console.log(`[products] Created ${vertical} instance for org ${organizationId}: ${instance.id}`);

    // If pharmacy, attach the config
    if (vertical === 'pharmacy') {
      await productDb.createPharmacyConfig({
        productInstanceId: instance.id,
        isEnabled: true,
        expiryWarningDays: 90,
        blockExpiredSales: true,
        requireBatchOnSale: true,
      });
      console.log(`[products] Created pharmacy config for instance ${instance.id}`);
    }
  }

  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'PRODUCT_ACTIVATED',
    resource: 'product',
    resourceId: product.id,
    metadata: { productKey: product.key, productName: product.name, vertical },
  });

  return await buildResponse();
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