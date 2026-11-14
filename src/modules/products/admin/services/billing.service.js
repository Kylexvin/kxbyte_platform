// src/modules/products/admin/services/billing.service.js
//
// Admin billing surface:
//   - Read/update the platform BillingConfig singleton
//   - Read revenue summary (aggregates from Payment table)
//   - List payments with filters
//   - Record offline payments (admin-verified)
//
// Never exposes config write in a tenant context.

import prisma from '../../../../database/postgres/prisma.js';
import audit from '../../../platform/audit/index.js';
import billingConfigService from '../../../platform/subscriptions/services/billing-config.service.js';
import {
  ValidationError,
  NotFoundError,
} from '../../kxcrm/domain/errors.js';

// ============================================================
// CONFIG — read + update (delegates to billingConfigService)
// ============================================================

const getConfig = async () => {
  return billingConfigService.getConfig();
};

const updateConfig = async (userId, patch) => {
  return billingConfigService.updateConfig(userId, patch);
};

// ============================================================
// SUMMARY — revenue metrics
// ============================================================

const getSummary = async () => {
  const [totals, byProduct, byStatus] = await Promise.all([
    // Total collected all-time + last 30d
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT s."productKey", SUM(p."amount")::bigint AS total, COUNT(p.id)::int AS count
      FROM "payments" p
      JOIN "subscriptions" s ON s.id = p."subscriptionId"
      WHERE p.status = 'COMPLETED'
      GROUP BY s."productKey"
    `,
    prisma.payment.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const last30 = await prisma.payment.aggregate({
    where: { status: 'COMPLETED', paidAt: { gte: thirtyDaysAgo } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  // Pending payments that need admin verification
  const pending = await prisma.payment.count({
    where: { status: 'PENDING' },
  });

  // Active subscriptions count (across all orgs, all products)
  const activeSubs = await prisma.subscription.count({
    where: { status: { in: ['TRIAL', 'ACTIVE'] } },
  });

  return {
    totals: {
      allTime: Number(totals._sum.amount || 0),
      allTimeCount: totals._count._all,
      last30Days: Number(last30._sum.amount || 0),
      last30DaysCount: last30._count._all,
    },
    pending,
    activeSubscriptions: activeSubs,
    byStatus: byStatus.map((b) => ({
      status: b.status,
      count: b._count._all,
      amount: Number(b._sum.amount || 0),
    })),
    byProduct: byProduct.map((b) => ({
      productKey: b.productKey,
      amount: Number(b.total || 0),
      count: Number(b.count || 0),
    })),
  };
};

// ============================================================
// PAYMENTS — list + record
// ============================================================

const listPayments = async (filters = {}, pagination = {}) => {
  const { productKey, status, search, organizationId, from, to } = filters;
  const { limit = 50, offset = 0 } = pagination;

  const where = {};

  if (status) where.status = status;

  if (from || to) {
    where.paidAt = {};
    if (from) where.paidAt.gte = new Date(from);
    if (to) where.paidAt.lte = new Date(to);
  }

  if (productKey) where.subscription = { productKey };
  if (organizationId) {
    where.subscription = {
      ...(where.subscription || {}),
      organizationId,
    };
  }

  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { subscription: { organization: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        subscription: {
          select: {
            productKey: true,
            status: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map((p) => ({
      id: p.id,
      subscriptionId: p.subscriptionId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      productKey: p.subscription?.productKey,
      organization: p.subscription?.organization,
      metadata: p.metadata,
    })),
    total,
    limit,
    offset,
  };
};

const recordPayment = async (userId, payload) => {
  const { subscriptionId, amount, method, reference, paidAt, notes } = payload;

  if (!subscriptionId) {
    throw new ValidationError('SUBSCRIPTION_ID_REQUIRED', 'subscriptionId is required');
  }
  if (!amount || Number(amount) <= 0) {
    throw new ValidationError('INVALID_AMOUNT', 'amount must be positive');
  }
  if (!method) {
    throw new ValidationError('METHOD_REQUIRED', 'method is required');
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!sub) throw new NotFoundError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

  const payment = await prisma.payment.create({
    data: {
      subscriptionId,
      amount: Number(amount),
      currency: sub.plan?.currency || 'KES',
      status: 'COMPLETED',
      method: String(method).toUpperCase(),
      reference: reference ? String(reference) : null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      metadata: {
        notes: notes || null,
        recordedByUserId: userId,
        recordedAt: new Date().toISOString(),
        source: 'ADMIN_MANUAL',
      },
    },
  });

  await audit.log({
    organizationId: sub.organization.id,
    userId,
    action: 'PAYMENT_RECORDED_BY_ADMIN',
    resource: 'payment',
    resourceId: payment.id,
    metadata: {
      subscriptionId,
      productKey: sub.productKey,
      organizationId: sub.organization.id,
      organizationName: sub.organization.name,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      reference: payment.reference,
    },
  });

  return payment;
};

// ============================================================
// SUBSCRIPTION LOOKUP (for the record payment form)
// ============================================================

const findSubscriptionForPayment = async (organizationId, productKey) => {
  return prisma.subscription.findUnique({
    where: {
      organizationId_productKey: { organizationId, productKey },
    },
    include: {
      plan: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
};

const listSubscriptionsForPicker = async (search, { limit = 20 } = {}) => {
  const where = {};
  if (search) {
    where.OR = [
      { organization: { name: { contains: search, mode: 'insensitive' } } },
      { organization: { slug: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const rows = await prisma.subscription.findMany({
    where,
    include: {
      plan: { select: { name: true, price: true, currency: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ status: 'asc' }, { currentPeriodEnd: 'asc' }],
    take: limit,
  });

  return rows.map((s) => ({
    subscriptionId: s.id,
    organizationId: s.organization.id,
    organizationName: s.organization.name,
    organizationSlug: s.organization.slug,
    productKey: s.productKey,
    status: s.status,
    planName: s.plan?.name || null,
    planPrice: s.plan?.price || null,
    currency: s.plan?.currency || 'KES',
    currentPeriodEnd: s.currentPeriodEnd,
  }));
};

export default {
  getConfig,
  updateConfig,
  getSummary,
  listPayments,
  recordPayment,
  findSubscriptionForPayment,
  listSubscriptionsForPicker,
};