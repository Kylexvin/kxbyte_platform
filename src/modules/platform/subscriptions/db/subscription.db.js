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

export default {
  createSubscription,
  findSubscription,
  findSubscriptionsByOrganization,
  updateSubscription,
  findSubscriptionById,
};