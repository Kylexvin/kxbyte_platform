// src/modules/platform/subscriptions/db/subscription.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createSubscription = async (data) => {
  return prisma.subscription.create({ data });
};

const findSubscription = async (organizationId, productKey) => {
  return prisma.subscription.findUnique({
    where: {
      organizationId_productKey: {
        organizationId,
        productKey,
      },
    },
    include: {
      plan: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

const findSubscriptionsByOrganization = async (organizationId) => {
  return prisma.subscription.findMany({
    where: { organizationId },
    include: {
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

const updateSubscription = async (id, data) => {
  return prisma.subscription.update({
    where: { id },
    data,
    include: {
      plan: true,
    },
  });
};

const findSubscriptionById = async (id) => {
  return prisma.subscription.findUnique({
    where: { id },
    include: {
      plan: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

const findSubscriptionsForSweep = async () => {
  return prisma.subscription.findMany({
    where: {
      status: { in: ['TRIAL', 'ACTIVE', 'GRACE'] },
    },
    include: {
      plan: true,
      organization: { select: { id: true, name: true, slug: true, ownerId: true } },
    },
  });
};

const findAllSubscriptions = async (filters = {}) => {
  const where = {};
  if (filters.productKey) where.productKey = filters.productKey;
  if (filters.status) where.status = filters.status;

  return prisma.subscription.findMany({
    where,
    include: {
      plan: true,
      organization: {
        select: { id: true, name: true, slug: true, ownerId: true, isActive: true },
      },
      payments: {
        orderBy: { paidAt: 'desc' },
        take: 5,
      },
    },
    orderBy: [{ status: 'asc' }, { currentPeriodEnd: 'asc' }],
  });
};

const findPaymentHistory = async (subscriptionId) => {
  return prisma.payment.findMany({
    where: { subscriptionId },
    orderBy: { paidAt: 'desc' },
  });
};

const recordPayment = async (data) => {
  return prisma.payment.create({ data });
};

export default {
  createSubscription,
  findSubscription,
  findSubscriptionsByOrganization,
  updateSubscription,
  findSubscriptionById,
  findSubscriptionsForSweep,
  findAllSubscriptions,
  findPaymentHistory,
  recordPayment,
};