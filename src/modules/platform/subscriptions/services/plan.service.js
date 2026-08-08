// src/modules/platform/subscriptions/services/plan.service.js

import planDb from '../db/plan.db.js';

const registerPlans = async (productKey, plans) => {
  if (!plans || plans.length === 0) {
    return [];
  }

  const results = [];
  for (const planData of plans) {
    const data = {
      productKey,
      key: planData.key,
      name: planData.name,
      price: planData.price,
      currency: planData.currency || 'KES',
      interval: planData.interval || 'MONTHLY',
      trialDays: planData.trialDays || 21,
      features: planData.features || [],
      limits: planData.limits || null,
      isActive: true,
    };
    const result = await planDb.upsertPlan(data);
    results.push(result);
  }

  return results;
};

const getPlansByProduct = async (productKey) => {
  return planDb.findPlansByProduct(productKey);
};

const getAllPlans = async () => {
  return planDb.findAllPlans();
};

const getPlanByKey = async (productKey, key) => {
  const plan = await planDb.findPlanByKey(productKey, key);
  if (!plan) {
    throw new Error('Plan not found');
  }
  return plan;
};

export default {
  registerPlans,
  getPlansByProduct,
  getAllPlans,
  getPlanByKey,
};