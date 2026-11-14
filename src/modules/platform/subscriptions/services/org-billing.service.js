// src/modules/platform/subscriptions/services/org-billing.service.js

import subscriptionDb from '../db/subscription.db.js';
import planDb from '../db/plan.db.js';
import orgDb from '../../organizations/db/org.db.js';
import subscriptionService from './subscription.service.js';
import billingConfigService from './billing-config.service.js';
import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// ACCESS MATRIX — generic per status
// ============================================================

const ACCESS = {
  TRIAL: {
    included: ['Full access to the product', 'All features enabled', 'All branches'],
    restricted: [],
  },
  ACTIVE: {
    included: ['Full access to the product', 'All features enabled', 'All branches'],
    restricted: [],
  },
  GRACE: {
    included: ['Login and access your account', 'View data', 'Generate reports', 'Export data'],
    restricted: ['Create new records', 'Update data', 'Process refunds'],
  },
  EXPIRED: {
    included: ['Login', 'View your account and billing'],
    restricted: ['All product features'],
  },
  SUSPENDED: {
    included: ['Login', 'View billing'],
    restricted: ['Everything else — account suspended by KxByte'],
  },
  CANCELLED: {
    included: ['Login', 'View billing'],
    restricted: ['Everything — subscription cancelled'],
  },
};

// ============================================================
// HELPERS
// ============================================================

function safeDate(d) {
  return d ? new Date(d).toDateString() : '—';
}

function addDays(date, days) {
  if (!date) return null;
  return new Date(new Date(date).getTime() + days * 86400000);
}

function dayWord(n) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

function accountNumberFor(cfg, productKey, organizationId) {
  return `${cfg.accountPrefix}${productKey.toUpperCase()}-${organizationId.slice(0, 8).toUpperCase()}`;
}

function buildWhatHappensNext(status, sub, cfg) {
  if (status === 'TRIAL') {
    const graceEnd = addDays(sub.trialEnd, cfg.graceDays);
    return {
      title: `Your trial ends ${safeDate(sub.trialEnd)}`,
      body: `After that you have ${dayWord(cfg.graceDays)} of read-only access (until ${safeDate(graceEnd)}). Writes are blocked after that unless renewed.`,
      graceStartsAt: sub.trialEnd,
      graceEndsAt: graceEnd,
    };
  }
  if (status === 'ACTIVE') {
    const graceEnd = addDays(sub.currentPeriodEnd, cfg.graceDays);
    return {
      title: `Your subscription renews on ${safeDate(sub.currentPeriodEnd)}`,
      body: `If not renewed by then, you get ${dayWord(cfg.graceDays)} of read-only access until ${safeDate(graceEnd)}, then writes are blocked.`,
      graceStartsAt: sub.currentPeriodEnd,
      graceEndsAt: graceEnd,
    };
  }
  if (status === 'GRACE') {
    return {
      title: `Read-only mode until ${safeDate(sub.graceEnd)}`,
      body: 'Renew now to restore full write access.',
      graceStartsAt: sub.graceStart,
      graceEndsAt: sub.graceEnd,
    };
  }
  if (status === 'EXPIRED') {
    return {
      title: `Subscription expired ${safeDate(sub.expiredAt)}`,
      body: 'Writes are blocked. Renew to restore full access immediately.',
      graceStartsAt: null,
      graceEndsAt: null,
    };
  }
  if (status === 'SUSPENDED') {
    return { title: 'Account suspended', body: 'Contact KxByte to resolve.', graceStartsAt: null, graceEndsAt: null };
  }
  if (status === 'CANCELLED') {
    return { title: 'Subscription cancelled', body: 'Contact KxByte to reactivate.', graceStartsAt: null, graceEndsAt: null };
  }
  return { title: '', body: '', graceStartsAt: null, graceEndsAt: null };
}

function buildAmountInfo({ plan, organizationId, productKey, lastPayment, cfg }) {
  const accountNumber = accountNumberFor(cfg, productKey, organizationId);

  const suggestedAmount =
    lastPayment?.amount ?? (plan?.price && plan.price > 0 ? plan.price : null);
  const currency = lastPayment?.currency || plan?.currency || 'KES';

  return {
    accountNumber,
    suggestedAmount,
    currency,
    amountIsCustom: suggestedAmount === null,
    displayAmount:
      suggestedAmount === null
        ? 'Custom — contact us'
        : `${currency} ${suggestedAmount}`,
  };
}

function buildPaymentInstructions({ accountNumber, cfg }) {
  const steps = [];

  if (cfg.paybill) {
    steps.push(
      'Go to M-Pesa → Lipa na M-Pesa → Pay Bill',
      `Business Number: ${cfg.paybill}`,
      `Account Number: ${accountNumber}`,
      'Enter the amount shown',
      `Confirm and share the M-Pesa code with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours'
    );
  } else if (cfg.tillNumber) {
    steps.push(
      'Go to M-Pesa → Lipa na M-Pesa → Buy Goods',
      `Till Number: ${cfg.tillNumber}`,
      'Enter the amount shown',
      `Confirm and share the M-Pesa code with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours'
    );
  } else if (cfg.mpesaPhone) {
    steps.push(
      'Go to M-Pesa → Send Money',
      `Phone Number: ${cfg.mpesaPhone}`,
      `Reference: ${accountNumber}`,
      'Enter the amount shown',
      `Share the M-Pesa confirmation SMS with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours'
    );
  } else if (cfg.bankName) {
    steps.push(
      `Bank transfer to ${cfg.bankName}`,
      `Account Name: ${cfg.bankAccountName}`,
      `Account Number: ${cfg.bankAccount}`,
      `Use Reference: ${accountNumber}`,
      `Email the transfer confirmation to ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours'
    );
  } else {
    steps.push(`Contact us at ${cfg.contactEmail} to arrange payment`);
  }

  const alternatives = [];
  if (cfg.paybill) alternatives.push(`Paybill: ${cfg.paybill} · A/C ${accountNumber}`);
  if (cfg.tillNumber) alternatives.push(`Buy Goods Till: ${cfg.tillNumber}`);
  if (cfg.mpesaPhone) alternatives.push(`Send Money to: ${cfg.mpesaPhone}`);
  if (cfg.bankName)
    alternatives.push(
      `Bank: ${cfg.bankName} · A/C ${cfg.bankAccount} · ${cfg.bankAccountName}`
    );

  return {
    paybill: cfg.paybill,
    accountNumber,
    tillNumber: cfg.tillNumber,
    mpesaPhone: cfg.mpesaPhone,
    bankName: cfg.bankName,
    bankAccount: cfg.bankAccount,
    bankAccountName: cfg.bankAccountName,
    contactEmail: cfg.contactEmail,
    contactPhone: cfg.contactPhone,
    steps,
    alternatives,
  };
}

function buildProductBlock({ sub, plan, productName, organizationId, payments, cfg }) {
  const status = sub.status;
  const lastPayment = payments.find((p) => p.status === 'COMPLETED');

  const access = ACCESS[status] || ACCESS.EXPIRED;
  const whatHappensNext = buildWhatHappensNext(status, sub, cfg);
  const amountInfo = buildAmountInfo({
    plan,
    organizationId,
    productKey: sub.productKey,
    lastPayment,
    cfg,
  });
  const paymentInstructions = buildPaymentInstructions({
    accountNumber: amountInfo.accountNumber,
    cfg,
  });

  const phaseStartAt =
    status === 'TRIAL' ? sub.trialStart :
    status === 'ACTIVE' ? sub.currentPeriodStart :
    status === 'GRACE' ? sub.graceStart :
    null;

  const phaseEndsAt =
    status === 'TRIAL' ? sub.trialEnd :
    status === 'ACTIVE' ? sub.currentPeriodEnd :
    status === 'GRACE' ? sub.graceEnd :
    null;

  const remainingDays =
    status === 'TRIAL' && sub.trialEnd
      ? Math.max(0, Math.ceil((new Date(sub.trialEnd) - Date.now()) / 86400000))
      : status === 'ACTIVE' && sub.currentPeriodEnd
      ? Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd) - Date.now()) / 86400000))
      : status === 'GRACE' && sub.graceEnd
      ? Math.max(0, Math.ceil((new Date(sub.graceEnd) - Date.now()) / 86400000))
      : null;

  return {
    productKey: sub.productKey,
    productName: productName || sub.productKey,
    status,
    isActive: status === 'TRIAL' || status === 'ACTIVE',
    isTrial: status === 'TRIAL',
    isGrace: status === 'GRACE',
    isExpired: status === 'EXPIRED',
    isSuspended: status === 'SUSPENDED',
    isCancelled: status === 'CANCELLED',
    remainingDays,
    phaseStartAt,
    phaseEndsAt,
    trialStart: sub.trialStart,
    trialEnd: sub.trialEnd,
    graceStart: sub.graceStart,
    graceEnd: sub.graceEnd,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    expiredAt: sub.expiredAt,
    nextDueAt: whatHappensNext.graceStartsAt,
    plan: plan
      ? {
          key: plan.key,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          trialDays: plan.trialDays,
        }
      : null,
    whatHappensNext,
    access,
    amount: amountInfo,
    paymentInstructions,
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      periodStart: p.metadata?.periodStart || null,
      periodEnd: p.metadata?.periodEnd || null,
      notes: p.metadata?.notes || null,
    })),
  };
}

// ============================================================
// MAIN — getBilling
// ============================================================

const getBilling = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) throw new Error('Organization not found');

  const cfg = await billingConfigService.getConfig();

  const subs = await subscriptionDb.findSubscriptionsByOrganization(organizationId);

  const products = await Promise.all(
    subs.map(async (sub) => {
      const plan = sub.planId ? await planDb.findPlanById(sub.planId) : null;
      const payments = await subscriptionDb.findPaymentHistory(sub.id);
      return buildProductBlock({
        sub,
        plan,
        productName: null,
        organizationId,
        payments,
        cfg,
      });
    })
  );

  const nextDueAt =
    products
      .map((p) => p.nextDueAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || null;

  const activeProductCount = products.filter((p) => p.isActive).length;

  const totalMonthly = products.every((p) => !p.amount.amountIsCustom)
    ? products.reduce((sum, p) => sum + (p.plan?.price || 0), 0)
    : null;

  const pendingPaymentCount = products.reduce(
    (count, p) => count + p.payments.filter((pay) => pay.status === 'PENDING').length,
    0
  );

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: org.currency || 'KES',
    },
    summary: {
      nextDueAt,
      totalMonthly,
      currency: org.currency || 'KES',
      outstanding: 0,
      activeProductCount,
      pendingPaymentCount,
    },
    products,
  };
};

// ============================================================
// notifyPayment
// ============================================================

const notifyPayment = async (organizationId, userId, payload) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const { productKey, amount, method, reference, notes } = payload;

  if (!productKey) throw new Error('productKey is required');
  if (!amount || Number(amount) <= 0) throw new Error('amount must be positive');
  if (!method) throw new Error('method is required');
  if (!reference) throw new Error('reference is required');

  const sub = await subscriptionDb.findSubscription(organizationId, productKey);
  if (!sub) throw new Error('No subscription found for this product');

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      amount: Number(amount),
      currency: 'KES',
      status: 'PENDING',
      method: String(method).toUpperCase(),
      reference: String(reference),
      paidAt: null,
      metadata: {
        notes: notes || null,
        notifiedByUserId: userId,
        notifiedAt: new Date().toISOString(),
      },
    },
  });

  try {
    const notifications = await import('../../notifications/index.js');
    const org = await orgDb.findOrganizationById(organizationId);
    await notifications.default.send({
      userId: org.ownerId,
      organizationId,
      type: 'PAYMENT_NOTICE_RECEIVED',
      title: 'Payment notice received',
      message: `We received your ${method} payment of ${amount} ${payment.currency} (ref ${reference}). We'll verify shortly.`,
      channel: 'IN_APP',
      productKey,
      resource: 'payment',
      resourceId: payment.id,
    });
  } catch (err) {
    console.error('Payment notice notification failed:', err.message);
  }

  return {
    id: payment.id,
    productKey,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    reference: payment.reference,
    status: payment.status,
    createdAt: payment.createdAt,
    message: 'Payment notice received. KxByte will verify and activate within 24 hours.',
  };
};

// ============================================================
// getTrialBurns
// ============================================================

const getTrialBurns = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) throw new Error('Organization not found');

  const burns = await prisma.trialBurn.findMany({
    where: { ownerUserId: org.ownerId },
    select: { productKey: true, burnedAt: true },
    orderBy: { burnedAt: 'asc' },
  });

  return { burns };
};

export default { getBilling, notifyPayment, getTrialBurns };