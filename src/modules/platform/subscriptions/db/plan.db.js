// src/modules/platform/subscriptions/db/plan.db.js

import prisma from '../../../../database/postgres/prisma.js';

const upsertPlan = async (data) => {
  return prisma.plan.upsert({
    where: {
      productKey_key: {
        productKey: data.productKey,
        key: data.key,
      },
    },
    update: {
      name: data.name,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      trialDays: data.trialDays,
      features: data.features,
      limits: data.limits,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    create: data,
  });
};

const findPlanByKey = async (productKey, key) => {
  return prisma.plan.findUnique({
    where: {
      productKey_key: {
        productKey,
        key,
      },
    },
  });
};

const findPlansByProduct = async (productKey) => {
  return prisma.plan.findMany({
    where: {
      productKey,
      isActive: true,
    },
    orderBy: { price: 'asc' },
  });
};

const findAllPlans = async () => {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { productKey: 'asc', price: 'asc' },
  });
};

const updatePlan = async (productKey, key, data) => {
  return prisma.plan.update({
    where: {
      productKey_key: {
        productKey,
        key,
      },
    },
    data,
  });
};

const findPlanById = async (id) => {
  return prisma.plan.findUnique({
    where: { id },
  });
};

export default {
  upsertPlan,
  findPlanByKey,
  findPlansByProduct,
  findAllPlans,
  updatePlan,
  findPlanById,
};