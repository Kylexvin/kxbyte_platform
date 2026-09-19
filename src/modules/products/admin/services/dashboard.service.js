// src/modules/products/admin/services/dashboard.service.js
import prisma from '../../../../database/postgres/prisma.js';
import { startOfMonth, addDays } from 'date-fns';

export const getDashboard = async () => {
  const now = new Date();
  const last7d = addDays(now, -7);
  const next7d = addDays(now, 7);
  const monthStart = startOfMonth(now);

  const realOrgFilter = { isInternal: false };
  const realSubFilter = {
    subscription: {
      organization: realOrgFilter,
      productKey: { not: 'admin' },
    },
  };

  const [
    totalUsers,
    totalOrgs,
    activeOrgs,
    internalOrgs,
    subsByStatus,
    recentSignups,
    recentSubs,
    recentPayments,
    revenueTotal,
    revenueThisMonth,
    openTickets,
    expiringSoon,
    inGrace,
    expired,
    products,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count({ where: realOrgFilter }),
    prisma.organization.count({ where: { ...realOrgFilter, isActive: true, isArchived: false } }),
    prisma.organization.count({ where: { isInternal: true } }),
    prisma.subscription.groupBy({
      by: ['status'],
      where: { organization: realOrgFilter },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: last7d } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { organization: realOrgFilter, productKey: { not: 'admin' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, productKey: true, status: true,
        trialEnd: true, graceEnd: true, currentPeriodEnd: true, createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.payment.findMany({
      where: { status: 'COMPLETED', ...realSubFilter },
      orderBy: { paidAt: 'desc' },
      take: 20,
      select: {
        id: true, amount: true, currency: true, method: true,
        reference: true, paidAt: true,
        subscription: {
          select: {
            productKey: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', ...realSubFilter },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', paidAt: { gte: monthStart }, ...realSubFilter },
      _sum: { amount: true },
    }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0),
    prisma.subscription.findMany({
      where: {
        status: { in: ['TRIAL', 'ACTIVE'] },
        organization: realOrgFilter,
        OR: [
          { trialEnd: { lte: next7d, gte: now } },
          { currentPeriodEnd: { lte: next7d, gte: now } },
        ],
      },
      orderBy: { trialEnd: 'asc' },
      take: 20,
      select: {
        id: true, productKey: true, status: true, trialEnd: true, currentPeriodEnd: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { status: 'GRACE', organization: realOrgFilter },
      orderBy: { graceEnd: 'asc' },
      take: 20,
      select: {
        id: true, productKey: true, graceEnd: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { status: 'EXPIRED', organization: realOrgFilter },
      orderBy: { expiredAt: 'desc' },
      take: 20,
      select: {
        id: true, productKey: true, expiredAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.findMany({
      where: { key: { not: 'admin' } },
      orderBy: { key: 'asc' },
    }),
  ]);

  const statusCounts = subsByStatus.reduce((acc, r) => {
    acc[r.status] = r._count._all;
    return acc;
  }, {});

  // Product adoption
  const adoption = await Promise.all(
    products.map(async (p) => {
      const [active, trial, expired, revenue] = await Promise.all([
        prisma.subscription.count({
          where: { productKey: p.key, status: 'ACTIVE', organization: realOrgFilter },
        }),
        prisma.subscription.count({
          where: { productKey: p.key, status: 'TRIAL', organization: realOrgFilter },
        }),
        prisma.subscription.count({
          where: { productKey: p.key, status: 'EXPIRED', organization: realOrgFilter },
        }),
        prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            subscription: { productKey: p.key, organization: realOrgFilter },
          },
          _sum: { amount: true },
        }),
      ]);
      return {
        key: p.key,
        name: p.name,
        active,
        trial,
        expired,
        revenue: revenue._sum.amount || 0,
      };
    })
  );

  return {
    totals: {
      users: totalUsers,
      organizations: totalOrgs,
      activeOrganizations: activeOrgs,
      internalOrganizations: internalOrgs,
      subscriptions: {
        trial: statusCounts.TRIAL || 0,
        active: statusCounts.ACTIVE || 0,
        grace: statusCounts.GRACE || 0,
        expired: statusCounts.EXPIRED || 0,
        suspended: statusCounts.SUSPENDED || 0,
        cancelled: statusCounts.CANCELLED || 0,
      },
      revenue: {
        total: revenueTotal._sum.amount || 0,
        currency: 'KES',
        paymentCount: revenueTotal._count._all || 0,
        thisMonth: revenueThisMonth._sum.amount || 0,
      },
      openSupportTickets: openTickets,
    },
    recent: {
      signups: recentSignups,
      subscriptions: recentSubs,
      payments: recentPayments,
    },
    alerts: {
      expiringSoon,
      inGrace,
      expired,
    },
    productAdoption: adoption,
  };
};