// src/modules/platform/subscriptions/services/subscription.service.js

import subscriptionDb from '../db/subscription.db.js';
import planDb from '../db/plan.db.js';
import orgDb from '../../organizations/db/org.db.js';
import { addDays } from 'date-fns';
import audit from '../../audit/index.js';

const SUBSCRIPTION_STATUS = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  GRACE: 'GRACE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  SUSPENDED: 'SUSPENDED',
};

const createSubscription = async (organizationId, productKey, planKey) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const plan = await planDb.findPlanByKey(productKey, planKey);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const existing = await subscriptionDb.findSubscription(organizationId, productKey);
  if (existing) {
    throw new Error('Subscription already exists for this product');
  }

  const now = new Date();
  const trialEnd = addDays(now, plan.trialDays);
  const periodEnd = addDays(now, plan.interval === 'MONTHLY' ? 30 : 365);

  const subscription = await subscriptionDb.createSubscription({
    organizationId,
    productKey,
    planId: plan.id,
    status: SUBSCRIPTION_STATUS.TRIAL,
    trialStart: now,
    trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  });

  // Audit log: Subscription created
  await audit.log({
    organizationId: organization.id,
    userId: null, // No user context here, will be added by caller
    action: 'SUBSCRIPTION_CREATED',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      productKey: productKey,
      planKey: plan.key,
      planName: plan.name,
      trialDays: plan.trialDays,
      trialEnd: trialEnd,
    },
  });

  return subscription;
};

const getSubscription = async (organizationId, productKey) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    return null;
  }

  const enriched = await enrichSubscription(subscription);
  return enriched;
};

const getOrganizationSubscriptions = async (organizationId) => {
  const subscriptions = await subscriptionDb.findSubscriptionsByOrganization(organizationId);
  const enriched = await Promise.all(
    subscriptions.map((sub) => enrichSubscription(sub))
  );
  return enriched;
};

const enrichSubscription = async (subscription) => {
  const now = new Date();
  const status = subscription.status;
  const enriched = { ...subscription };

  let remainingDays = 0;
  if (status === 'TRIAL' && subscription.trialEnd) {
    remainingDays = Math.ceil((subscription.trialEnd - now) / (1000 * 60 * 60 * 24));
    if (remainingDays < 0) remainingDays = 0;
  } else if (status === 'GRACE' && subscription.graceEnd) {
    remainingDays = Math.ceil((subscription.graceEnd - now) / (1000 * 60 * 60 * 24));
    if (remainingDays < 0) remainingDays = 0;
  } else if (status === 'ACTIVE' && subscription.currentPeriodEnd) {
    remainingDays = Math.ceil((subscription.currentPeriodEnd - now) / (1000 * 60 * 60 * 24));
    if (remainingDays < 0) remainingDays = 0;
  }

  enriched.remainingDays = remainingDays;
  enriched.isActive = status === 'TRIAL' || status === 'ACTIVE';
  enriched.isTrial = status === 'TRIAL';
  enriched.isExpired = status === 'EXPIRED';

  return enriched;
};

const updateSubscriptionStatus = async (id, status, data = {}) => {
  const subscription = await subscriptionDb.updateSubscription(id, {
    status,
    ...data,
  });
  return enrichSubscription(subscription);
};

const getSubscriptionStatus = async (organizationId, productKey) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    return { status: 'NONE', isActive: false };
  }

  const enriched = await enrichSubscription(subscription);
  return {
    status: enriched.status,
    isActive: enriched.isActive,
    isTrial: enriched.isTrial,
    plan: enriched.plan,
    remainingDays: enriched.remainingDays,
    trialEnd: enriched.trialEnd,
    currentPeriodEnd: enriched.currentPeriodEnd,
  };
};

const cancelSubscription = async (organizationId, productKey, userId = null) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const result = await subscriptionDb.updateSubscription(subscription.id, {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    cancelledAt: new Date(),
  });

  // Audit log: Subscription cancelled
  await audit.log({
    organizationId: organizationId,
    userId: userId,
    action: 'SUBSCRIPTION_CANCELLED',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      productKey: productKey,
      planId: subscription.planId,
    },
  });

  return result;
};

const renewSubscription = async (organizationId, productKey, userId = null) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const now = new Date();
  const plan = await planDb.findPlanById(subscription.planId);
  const periodEnd = addDays(now, plan.interval === 'MONTHLY' ? 30 : 365);

  const result = await subscriptionDb.updateSubscription(subscription.id, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    graceStart: null,
    graceEnd: null,
  });

  // Audit log: Subscription renewed
  await audit.log({
    organizationId: organizationId,
    userId: userId,
    action: 'SUBSCRIPTION_RENEWED',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      productKey: productKey,
      planId: subscription.planId,
      periodEnd: periodEnd,
    },
  });

  return result;
};

export default {
  createSubscription,
  getSubscription,
  getOrganizationSubscriptions,
  getSubscriptionStatus,
  updateSubscriptionStatus,
  cancelSubscription,
  renewSubscription,
  SUBSCRIPTION_STATUS,
};