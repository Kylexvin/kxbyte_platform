// src/modules/platform/subscriptions/index.js

import subscriptionRoutes from './routes/subscription.routes.js';
import subscriptionService from './services/subscription.service.js';
import planService from './services/plan.service.js';
import subscriptionMiddleware from './middleware/subscription.middleware.js';
import subscriptionController from './controllers/subscription.controller.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/subscriptions', subscriptionRoutes);
  app.get('/api/v1/plans', subscriptionController.listPlans); 
};

export default {
  register,
  // Plan registration (for products)
  registerPlans: planService.registerPlans,
  getPlansByProduct: planService.getPlansByProduct,
  getAllPlans: planService.getAllPlans,
  getPlanByKey: planService.getPlanByKey,
  // Subscription operations
  createSubscription: subscriptionService.createSubscription,
  getSubscription: subscriptionService.getSubscription,
  getOrganizationSubscriptions: subscriptionService.getOrganizationSubscriptions,
  getSubscriptionStatus: subscriptionService.getSubscriptionStatus,
  cancelSubscription: subscriptionService.cancelSubscription,
  renewSubscription: subscriptionService.renewSubscription,
  // Middleware
  requireActiveSubscription: subscriptionMiddleware.requireActiveSubscription,
};