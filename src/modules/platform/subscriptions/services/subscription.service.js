// src/modules/platform/subscriptions/services/subscription.service.js

import subscriptionDb from '../db/subscription.db.js';
import planDb from '../db/plan.db.js';
import orgDb from '../../organizations/db/org.db.js';
import { addDays } from 'date-fns';
import audit from '../../audit/index.js';
import payment from '../../payment/index.js';

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

// ============================================================
// PAYMENT INTEGRATION
// ============================================================

const initiateSubscriptionPayment = async (organizationId, productKey, userId) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const plan = await planDb.findPlanById(subscription.planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get user for billing email
  const user = await orgDb.findUserById(userId);

  // Initiate payment
  const paymentResult = await payment.initiatePayment(
    userId,
    organizationId,
    productKey,
    subscription.id,
    {
      amount: plan.price,
      currency: plan.currency || 'KES',
      description: `${plan.name} subscription - ${productKey}`,
      billingAddress: {
        email: user?.email || '',
        phone: '',
        country: 'KE',
      },
    }
  );

  // Store payment reference on subscription
  await subscriptionDb.updateSubscription(subscription.id, {
    metadata: {
      ...(subscription.metadata || {}),
      paymentTransactionId: paymentResult.transactionId,
      paymentMerchantReference: paymentResult.merchantReference,
    },
  });

  // Audit log
  await audit.log({
    organizationId,
    userId,
    action: 'SUBSCRIPTION_PAYMENT_INITIATED',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      productKey,
      planKey: plan.key,
      amount: plan.price,
      transactionId: paymentResult.transactionId,
    },
  });

  return {
    subscriptionId: subscription.id,
    transactionId: paymentResult.transactionId,
    merchantReference: paymentResult.merchantReference,
    redirectUrl: paymentResult.redirectUrl,
  };
};

const handleSubscriptionPaymentSuccess = async (organizationId, productKey, transactionId) => {
  const subscription = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const plan = await planDb.findPlanById(subscription.planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const now = new Date();
  const periodEnd = addDays(now, plan.interval === 'MONTHLY' ? 30 : 365);

  // Update subscription to ACTIVE
  await subscriptionDb.updateSubscription(subscription.id, {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    graceStart: null,
    graceEnd: null,
  });

  // Audit log
  await audit.log({
    organizationId,
    action: 'SUBSCRIPTION_PAYMENT_SUCCESS',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      transactionId,
      productKey,
      planKey: plan.key,
      periodEnd,
    },
  });

  // Send notification
  try {
    const notification = await import('../../notifications/index.js');
    const org = await orgDb.findOrganizationById(organizationId);
    const user = await orgDb.findUserById(org.ownerId);
    
    await notification.default.send({
      userId: user.id,
      organizationId,
      type: 'SUBSCRIPTION_ACTIVATED',
      title: 'Subscription Activated',
      message: `Your ${productKey} subscription is now active.`,
      channel: 'IN_APP',
      metadata: {
        productKey,
        planKey: plan.key,
        expiresAt: periodEnd,
      },
    });
  } catch (error) {
    console.error('Failed to send subscription notification:', error.message);
  }

  return {
    success: true,
    subscriptionId: subscription.id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    periodEnd,
  };
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
  initiateSubscriptionPayment,
  handleSubscriptionPaymentSuccess,
  SUBSCRIPTION_STATUS,
};