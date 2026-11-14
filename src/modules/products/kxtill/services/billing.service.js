// src/modules/products/kxtill/services/billing.service.js

import subscriptionService from '../../../platform/subscriptions/services/subscription.service.js';
import subscriptionDb from '../../../platform/subscriptions/db/subscription.db.js';
import planDb from '../../../platform/subscriptions/db/plan.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import billingConfigService from '../../../platform/subscriptions/services/billing-config.service.js';

const PRODUCT_KEY = 'kxtill';

// ============================================================
// ACCESS MATRIX — what works at each status
// ============================================================

const ACCESS = {
  TRIAL: {
    included: [
      'Full access to Point of Sale',
      'Create and manage sales',
      'Add and update products',
      'Manage stock and inventory',
      'Create and manage customers',
      'Generate reports and export',
      'All branches',
    ],
    restricted: [],
  },
  ACTIVE: {
    included: [
      'Full access to Point of Sale',
      'Create and manage sales',
      'Add and update products',
      'Manage stock and inventory',
      'Create and manage customers',
      'Generate reports and export',
      'All branches',
    ],
    restricted: [],
  },
  GRACE: {
    included: [
      'Login and access your account',
      'View sales, products, stock',
      'View customers',
      'Generate reports',
      'Export data',
    ],
    restricted: [
      'Create new sales',
      'Add or update products',
      'Update stock levels',
      'Process refunds',
      'Transfer stock between branches',
      'Create customers',
    ],
  },
  EXPIRED: {
    included: ['Login', 'View your account and billing'],
    restricted: [
      'Point of Sale',
      'Sales history',
      'Inventory',
      'Customers',
      'Reports',
      'Exports',
    ],
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

function buildWhatHappensNext(status, sub, cfg) {
  if (status === 'TRIAL') {
    const graceStart = addDays(sub.trialEnd, 0);
    const graceEnd = addDays(sub.trialEnd, cfg.graceDays);
    return {
      title: `Your trial ends ${safeDate(sub.trialEnd)}`,
      body: `After that you have ${dayWord(cfg.graceDays)} of read-only access (until ${safeDate(
        graceEnd
      )}). Writes are blocked after that unless renewed.`,
      graceStartsAt: graceStart,
      graceEndsAt: graceEnd,
    };
  }
  if (status === 'ACTIVE') {
    const graceEnd = addDays(sub.currentPeriodEnd, cfg.graceDays);
    return {
      title: `Your subscription renews on ${safeDate(sub.currentPeriodEnd)}`,
      body: `If not renewed by then, you get ${dayWord(cfg.graceDays)} of read-only access until ${safeDate(
        graceEnd
      )}, then writes are blocked.`,
      graceStartsAt: sub.currentPeriodEnd,
      graceEndsAt: graceEnd,
    };
  }
  if (status === 'GRACE') {
    return {
      title: `Read-only mode until ${safeDate(sub.graceEnd)}`,
      body: 'Renew now to restore full write access. After this date, your account becomes fully read-only-locked.',
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
    return {
      title: 'Account suspended',
      body: 'Contact KxByte to resolve the issue and restore access.',
      graceStartsAt: null,
      graceEndsAt: null,
    };
  }
  if (status === 'CANCELLED') {
    return {
      title: 'Subscription cancelled',
      body: 'Contact KxByte to reactivate your subscription.',
      graceStartsAt: null,
      graceEndsAt: null,
    };
  }
  return { title: '', body: '', graceStartsAt: null, graceEndsAt: null };
}

function buildAmountInfo({ plan, organizationId, lastPayment, cfg }) {
  const accountNumber = `${cfg.accountPrefix}${organizationId.slice(0, 8).toUpperCase()}`;

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

function buildHowToPay({ accountNumber, suggestedAmount, currency, cfg }) {
  const amountLine = suggestedAmount
    ? `Amount: ${currency} ${suggestedAmount}`
    : 'Amount: confirm with us on WhatsApp before sending';

  let primarySteps;

  if (cfg.paybill) {
    primarySteps = [
      'Go to M-Pesa → Lipa na M-Pesa → Pay Bill',
      `Business Number: ${cfg.paybill}`,
      `Account Number: ${accountNumber}`,
      amountLine,
      `Confirm and share the M-Pesa code with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours',
    ];
  } else if (cfg.tillNumber) {
    primarySteps = [
      'Go to M-Pesa → Lipa na M-Pesa → Buy Goods',
      `Till Number: ${cfg.tillNumber}`,
      amountLine,
      `Confirm and share the M-Pesa code with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours',
    ];
  } else if (cfg.mpesaPhone) {
    primarySteps = [
      'Go to M-Pesa → Send Money',
      `Phone Number: ${cfg.mpesaPhone}`,
      amountLine,
      `Reference: ${accountNumber}`,
      `Share the M-Pesa confirmation SMS with ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours',
    ];
  } else if (cfg.bankName) {
    primarySteps = [
      `Bank transfer to ${cfg.bankName}`,
      `Account Name: ${cfg.bankAccountName}`,
      `Account Number: ${cfg.bankAccount}`,
      amountLine,
      `Use Reference: ${accountNumber}`,
      `Email the transfer confirmation to ${cfg.contactEmail}`,
      'We activate your subscription within 24 hours',
    ];
  } else {
    primarySteps = [`Contact us at ${cfg.contactEmail} to arrange payment`];
  }

  const alternatives = [];
  if (cfg.paybill) alternatives.push(`Paybill: ${cfg.paybill} · A/C ${accountNumber}`);
  if (cfg.tillNumber) alternatives.push(`Buy Goods Till: ${cfg.tillNumber}`);
  if (cfg.mpesaPhone) alternatives.push(`M-Pesa Send Money: ${cfg.mpesaPhone}`);
  if (cfg.bankName)
    alternatives.push(
      `Bank: ${cfg.bankName} · A/C ${cfg.bankAccount} · ${cfg.bankAccountName}`
    );

  return { steps: primarySteps, alternatives };
}

// ============================================================
// MAIN
// ============================================================

const getBilling = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const cfg = await billingConfigService.getConfig();

  const status = await subscriptionService.getSubscriptionStatus(organizationId, PRODUCT_KEY);
  if (status.status === 'NONE') throw new Error('No subscription found for this product');

  const sub = await subscriptionDb.findSubscription(organizationId, PRODUCT_KEY);
  const plan = sub?.planId ? await planDb.findPlanById(sub.planId) : null;

  const payments = await subscriptionDb.findPaymentHistory(sub.id);
  const lastPayment = payments.find((p) => p.status === 'COMPLETED');

  const access = ACCESS[status.status] || ACCESS.EXPIRED;
  const whatHappensNext = buildWhatHappensNext(status.status, sub, cfg);
  const amountInfo = buildAmountInfo({
    plan,
    organizationId,
    lastPayment,
    cfg,
  });
  const howToPay = buildHowToPay({
    accountNumber: amountInfo.accountNumber,
    suggestedAmount: amountInfo.suggestedAmount,
    currency: amountInfo.currency,
    cfg,
  });

  const phaseStartAt =
    status.status === 'TRIAL' ? sub.trialStart :
    status.status === 'ACTIVE' ? sub.currentPeriodStart :
    status.status === 'GRACE' ? sub.graceStart :
    null;

  const phaseEndsAt =
    status.status === 'TRIAL' ? sub.trialEnd :
    status.status === 'ACTIVE' ? sub.currentPeriodEnd :
    status.status === 'GRACE' ? sub.graceEnd :
    null;

  return {
    productKey: PRODUCT_KEY,
    productName: 'KxTill',
    organizationId,

    status: status.status,
    isActive: status.isActive,
    isTrial: status.isTrial,
    isGrace: status.isGrace,
    isExpired: status.status === 'EXPIRED',
    isSuspended: status.status === 'SUSPENDED',
    isCancelled: status.status === 'CANCELLED',

    remainingDays: status.remainingDays,
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
    howToPay,

    payment: {
      ...amountInfo,
      paybill: cfg.paybill,
      tillNumber: cfg.tillNumber,
      mpesaPhone: cfg.mpesaPhone,
      bankName: cfg.bankName,
      bankAccount: cfg.bankAccount,
      bankAccountName: cfg.bankAccountName,
      contactEmail: cfg.contactEmail,
      contactPhone: cfg.contactPhone,
    },
  };
};

const getPayments = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) throw new Error('You do not have access to this organization');

  const sub = await subscriptionDb.findSubscription(organizationId, PRODUCT_KEY);
  if (!sub) return [];

  const payments = await subscriptionDb.findPaymentHistory(sub.id);

  return payments.map((p) => ({
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
  }));
};

export default { getBilling, getPayments };