// src/modules/platform/subscriptions/index.js

import subscriptionRoutes from './routes/subscription.routes.js';
import orgBillingRoutes from './routes/org-billing.routes.js';
import subscriptionService from './services/subscription.service.js';
import planService from './services/plan.service.js';
import subscriptionMiddleware from './middleware/subscription.middleware.js';
import subscriptionController from './controllers/subscription.controller.js';

const register = (app) => {
  // Org-scoped subscription routes: /organizations/:organizationId/subscriptions/*
  app.use('/api/v1/organizations/:organizationId/subscriptions', subscriptionRoutes);

  // Org-scoped billing + trial-burn routes: /organizations/:organizationId/billing, /trial-burns
  app.use('/api/v1/organizations/:organizationId', orgBillingRoutes);

  // Public plan list
  app.get('/api/v1/plans', subscriptionController.listPlans);
};

export default {
  register,
  registerPlans: planService.registerPlans,
  getPlansByProduct: planService.getPlansByProduct,
  getAllPlans: planService.getAllPlans,
  getPlanByKey: planService.getPlanByKey,
  createSubscription: subscriptionService.createSubscription,
  getSubscription: subscriptionService.getSubscription,
  getOrganizationSubscriptions: subscriptionService.getOrganizationSubscriptions,
  getSubscriptionStatus: subscriptionService.getSubscriptionStatus,
  cancelSubscription: subscriptionService.cancelSubscription,
  renewSubscription: subscriptionService.renewSubscription,
  requireActiveSubscription: subscriptionMiddleware.requireActiveSubscription,
};