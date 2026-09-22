// src/modules/platform/subscriptions/services/subscription.service.js

import prisma from '../../../../database/postgres/prisma.js';
import subscriptionDb from '../db/subscription.db.js';
import notificationDb from '../../notifications/db/notification.db.js';
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

const GRACE_DAYS = 2;

const REMINDER_THRESHOLDS = [7, 3, 1];
// ============================================================
// TRIAL BURN TRACKING
// ============================================================

const isTrialBurned = async (ownerUserId, productKey) => {
  const burn = await prisma.trialBurn.findUnique({
    where: {
      ownerUserId_productKey: { ownerUserId, productKey },
    },
  });
  return !!burn;
};

const markTrialBurned = async (ownerUserId, productKey, organizationId) => {
  try {
    await prisma.trialBurn.create({
      data: { ownerUserId, productKey, organizationId },
    });
  } catch (err) {
    // P2002 = unique constraint violated → already burned, safe to ignore
    if (err.code !== 'P2002') throw err;
  }
}; 

// ============================================================
// SUBSCRIPTION CREATION — NO TRIAL (trial already burned)
// ============================================================

const createSubscriptionWithoutTrial = async (organizationId, productKey, planKey) => {
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

  const subscription = await subscriptionDb.createSubscription({
    organizationId,
    productKey,
    planId: plan.id,
    status: 'EXPIRED',
    expiredAt: now,
    trialStart: null,
    trialEnd: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });

  await audit.log({
    organizationId,
    userId: null,
    action: 'SUBSCRIPTION_CREATED_NO_TRIAL',
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: {
      productKey,
      planKey: plan.key,
      reason: 'owner_trial_burned',
    },
  });

  return subscription;
};

// ============================================================
// CRON SWEEP — daily
// ============================================================

// ============================================================
// PRE-EXPIRY REMINDERS — TRIAL and ACTIVE
// ============================================================


const fireReminderIfDue = async (sub, field, label) => {
  const targetDate = sub[field];
  if (!targetDate) return;

  const now = new Date();
  const diffDays = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));

  if (!REMINDER_THRESHOLDS.includes(diffDays)) return;

  const type = 'SUBSCRIPTION_EXPIRING_SOON';
  const existing = await notificationDb.findNotificationByTypeAndResource({
    type,
    resource: 'subscription',
    resourceId: sub.id,
    threshold: diffDays,
  });
  if (existing) return;

  try {
    const notifications = await import('../../notifications/index.js');
    const org = await orgDb.findOrganizationById(sub.organizationId);
    if (!org?.ownerId) return;

    await notifications.default.send({
      userId: org.ownerId,
      organizationId: sub.organizationId,
      type,
      title: `${diffDays} day${diffDays === 1 ? '' : 's'} left on your ${sub.productKey} subscription`,
      message: `Your ${sub.productKey} ${label} ends on ${targetDate.toDateString()}. Renew to keep full access.`,
      channel: 'IN_APP',
      productKey: sub.productKey,
      resource: 'subscription',
      resourceId: sub.id,
      metadata: { threshold: diffDays, targetDate, field, phase: label },
    });
  } catch (err) {
    console.error(`Reminder failed for ${sub.id}:`, err.message);
  }
};

const runSweep = async () => {
  const now = new Date();
  const subs = await subscriptionDb.findSubscriptionsForSweep();
  const transitions = [];

  for (const sub of subs) {
    try {
      // Pre-expiry reminders (only while still TRIAL or ACTIVE, before any transition)
      if (sub.status === 'TRIAL') {
        await fireReminderIfDue(sub, 'trialEnd', 'trial');
      } else if (sub.status === 'ACTIVE') {
        await fireReminderIfDue(sub, 'currentPeriodEnd', 'billing period');
      }

      // TRIAL → GRACE (trial ended)
      if (sub.status === 'TRIAL' && sub.trialEnd && sub.trialEnd <= now) {
        const graceStart = now;
        const graceEnd = addDays(now, GRACE_DAYS);
        await subscriptionDb.updateSubscription(sub.id, {
          status: 'GRACE',
          graceStart,
          graceEnd,
        });
        await audit.log({
          organizationId: sub.organizationId,
          userId: null,
          action: 'SUBSCRIPTION_ENTERED_GRACE',
          resource: 'subscription',
          resourceId: sub.id,
          metadata: { productKey: sub.productKey, graceStart, graceEnd, fromTrialEnd: sub.trialEnd },
        });
        await fireNotification(sub, 'SUBSCRIPTION_GRACE_STARTED', {
          graceEnd,
          daysLeft: GRACE_DAYS,
        });
        transitions.push({ id: sub.id, from: 'TRIAL', to: 'GRACE' });
        continue;
      }

      // GRACE → EXPIRED (grace ended)
      if (sub.status === 'GRACE' && sub.graceEnd && sub.graceEnd <= now) {
        await subscriptionDb.updateSubscription(sub.id, {
          status: 'EXPIRED',
          expiredAt: now,
        });
        await audit.log({
          organizationId: sub.organizationId,
          userId: null,
          action: 'SUBSCRIPTION_EXPIRED',
          resource: 'subscription',
          resourceId: sub.id,
          metadata: { productKey: sub.productKey, expiredAt: now },
        });
        await fireNotification(sub, 'SUBSCRIPTION_EXPIRED', { expiredAt: now });
        transitions.push({ id: sub.id, from: 'GRACE', to: 'EXPIRED' });
        continue;
      }

      // ACTIVE → GRACE (period ended, give read-only grace too)
      if (sub.status === 'ACTIVE' && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
        const graceStart = now;
        const graceEnd = addDays(now, GRACE_DAYS);
        await subscriptionDb.updateSubscription(sub.id, {
          status: 'GRACE',
          graceStart,
          graceEnd,
        });
        await audit.log({
          organizationId: sub.organizationId,
          userId: null,
          action: 'SUBSCRIPTION_ENTERED_GRACE',
          resource: 'subscription',
          resourceId: sub.id,
          metadata: { productKey: sub.productKey, graceStart, graceEnd, fromPeriodEnd: sub.currentPeriodEnd },
        });
        await fireNotification(sub, 'SUBSCRIPTION_GRACE_STARTED', {
          graceEnd,
          daysLeft: GRACE_DAYS,
        });
        transitions.push({ id: sub.id, from: 'ACTIVE', to: 'GRACE' });
      }
    } catch (err) {
      console.error(`Sweep failed for subscription ${sub.id}:`, err.message);
    }
  }

  console.log(`[subscription-sweep] processed ${subs.length}, transitions:`, transitions);
  return transitions;
};

const fireNotification = async (sub, type, metadata) => {
  try {
    const notifications = await import('../../notifications/index.js');
    const org = await orgDb.findOrganizationById(sub.organizationId);
    if (!org?.ownerId) return;
    await notifications.default.send({
      userId: org.ownerId,
      organizationId: sub.organizationId,
      type,
      title: type === 'SUBSCRIPTION_EXPIRED' ? 'Subscription Expired' : 'Subscription Entering Grace Period',
      message: type === 'SUBSCRIPTION_EXPIRED'
        ? `Your ${sub.productKey} subscription has expired. Renew to restore write access.`
        : `Your ${sub.productKey} subscription will enter a 2-day read-only window.`,
      channel: 'IN_APP',
      metadata: { productKey: sub.productKey, ...metadata },
    });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
};

// ============================================================
// ADMIN MANUAL ACTIONS
// ============================================================

const adminSetStatus = async (organizationId, productKey, adminUserId, payload) => {
  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');

  const allowed = ['TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'];
  if (!allowed.includes(payload.status)) throw new Error('Invalid status');

  const updates = { status: payload.status };
  if (payload.trialEnd !== undefined) updates.trialEnd = payload.trialEnd ? new Date(payload.trialEnd) : null;
  if (payload.currentPeriodStart !== undefined) updates.currentPeriodStart = payload.currentPeriodStart ? new Date(payload.currentPeriodStart) : null;
  if (payload.currentPeriodEnd !== undefined) updates.currentPeriodEnd = payload.currentPeriodEnd ? new Date(payload.currentPeriodEnd) : null;
  if (payload.graceStart !== undefined) updates.graceStart = payload.graceStart ? new Date(payload.graceStart) : null;
  if (payload.graceEnd !== undefined) updates.graceEnd = payload.graceEnd ? new Date(payload.graceEnd) : null;

  // Clear grace window when leaving GRACE
  if (payload.status === 'ACTIVE' || payload.status === 'TRIAL') {
    if (payload.graceStart === undefined) updates.graceStart = null;
    if (payload.graceEnd === undefined) updates.graceEnd = null;
  }

  // Clear expiredAt when leaving EXPIRED
  if (payload.status !== 'EXPIRED' && sub.status === 'EXPIRED') {
    updates.expiredAt = null;
  }

  // Clear cancelledAt when leaving CANCELLED
  if (payload.status !== 'CANCELLED' && sub.status === 'CANCELLED') {
    updates.cancelledAt = null;
  }

  if (payload.status === 'EXPIRED' && !updates.expiredAt) updates.expiredAt = new Date();
  if (payload.status === 'CANCELLED') updates.cancelledAt = new Date();

  const result = await subscriptionDb.updateSubscription(sub.id, updates);

  await audit.log({
    organizationId,
    userId: adminUserId,
    action: 'SUBSCRIPTION_ADMIN_STATUS_SET',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: { productKey, from: sub.status, to: payload.status, updates },
  });

  return result;
};

const adminSetDates = async (organizationId, productKey, adminUserId, payload) => {
  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');

  const updates = {};
  for (const f of ['trialStart', 'trialEnd', 'graceStart', 'graceEnd', 'currentPeriodStart', 'currentPeriodEnd']) {
    if (payload[f] !== undefined) updates[f] = payload[f] ? new Date(payload[f]) : null;
  }

  const result = await subscriptionDb.updateSubscription(sub.id, updates);
  await audit.log({
    organizationId,
    userId: adminUserId,
    action: 'SUBSCRIPTION_ADMIN_DATES_SET',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: { productKey, updates },
  });
  return result;
};

const adminRenew = async (organizationId, productKey, adminUserId, payload) => {
  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');

  const now = new Date();
  const start = payload.periodStart ? new Date(payload.periodStart) : now;
  const end = payload.periodEnd ? new Date(payload.periodEnd) : addDays(start, 30);

  // record payment (history)
  const payment = await subscriptionDb.recordPayment({
    subscriptionId: sub.id,
    amount: payload.amount,
    currency: payload.currency || 'KES',
    status: 'COMPLETED',
    method: payload.method || 'MANUAL',
    reference: payload.reference || null,
    paidAt: now,
    metadata: {
      periodStart: start,
      periodEnd: end,
      notes: payload.notes || null,
      recordedByUserId: adminUserId,
    },
  });

  // flip to ACTIVE
  const result = await subscriptionDb.updateSubscription(sub.id, {
    status: 'ACTIVE',
    currentPeriodStart: start,
    currentPeriodEnd: end,
    graceStart: null,
    graceEnd: null,
    expiredAt: null,
  });

  await audit.log({
    organizationId,
    userId: adminUserId,
    action: 'SUBSCRIPTION_RENEWED',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: {
      productKey,
      amount: payload.amount,
      currency: payload.currency || 'KES',
      reference: payload.reference || null,
      periodStart: start,
      periodEnd: end,
      paymentId: payment.id,
    },
  });

  return { subscription: result, payment };
};

const adminExtendTrial = async (organizationId, productKey, adminUserId, days) => {
  if (!days || days < 1) throw new Error('days must be a positive integer');

  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');

  const base = sub.trialEnd && sub.trialEnd > new Date() ? sub.trialEnd : new Date();
  const trialEnd = addDays(base, days);

  const result = await subscriptionDb.updateSubscription(sub.id, {
    status: 'TRIAL',
    trialEnd,
    graceStart: null,
    graceEnd: null,
    expiredAt: null,
  });

  await audit.log({
    organizationId,
    userId: adminUserId,
    action: 'SUBSCRIPTION_TRIAL_EXTENDED',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: {
      productKey,
      days,
      previousTrialEnd: sub.trialEnd,
      newTrialEnd: trialEnd,
    },
  });

  return result;
};

const adminSuspend = async (organizationId, productKey, adminUserId, reason) => {
  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');
  const result = await subscriptionDb.updateSubscription(sub.id, { status: 'SUSPENDED' });
  await audit.log({
    organizationId,
    userId: adminUserId,
    action: 'SUBSCRIPTION_SUSPENDED',
    resource: 'subscription',
    resourceId: sub.id,
    metadata: { productKey, reason: reason || null },
  });
  return result;
};

const getPaymentHistory = async (organizationId, productKey) => {
  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('Subscription not found');
  return subscriptionDb.findPaymentHistory(sub.id);
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

 
  enriched.isGrace = status === 'GRACE';
  enriched.isSuspended = status === 'SUSPENDED';
  enriched.isCancelled = status === 'CANCELLED';

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
    isGrace: enriched.status === 'GRACE',
    plan: enriched.plan,
    remainingDays: enriched.remainingDays,
    trialEnd: enriched.trialEnd,
    graceStart: enriched.graceStart,
    graceEnd: enriched.graceEnd,
    currentPeriodStart: enriched.currentPeriodStart,
    currentPeriodEnd: enriched.currentPeriodEnd,
    expiredAt: enriched.expiredAt,
    cancelledAt: enriched.cancelledAt,
  };
};

const adminListAll = async (filters = {}) => {
  const subs = await subscriptionDb.findAllSubscriptions(filters);
  return Promise.all(subs.map((s) => enrichSubscription(s)));
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
  runSweep,
  adminSetStatus,
  adminSetDates,
  adminRenew,
  adminSuspend,
  getPaymentHistory,
  adminListAll,
  adminExtendTrial,
  isTrialBurned,
  markTrialBurned,
  createSubscriptionWithoutTrial,
};