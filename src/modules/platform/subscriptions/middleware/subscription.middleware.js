// src/modules/platform/subscriptions/middleware/subscription.middleware.js

import subscriptionService from '../services/subscription.service.js';

const requireActiveSubscription = (productKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get organizationId from params or body
      const organizationId = req.params.organizationId || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const status = await subscriptionService.getSubscriptionStatus(organizationId, productKey);

      if (status.status === 'NONE') {
        return res.status(403).json({
          error: 'No subscription found for this product',
          code: 'NO_SUBSCRIPTION',
        });
      }

      if (status.status === 'EXPIRED') {
        return res.status(403).json({
          error: 'Subscription has expired. Please renew.',
          code: 'SUBSCRIPTION_EXPIRED',
          expiredAt: status.expiredAt,
        });
      }

      if (status.status === 'CANCELLED') {
        return res.status(403).json({
          error: 'Subscription has been cancelled.',
          code: 'SUBSCRIPTION_CANCELLED',
        });
      }

      if (status.status === 'SUSPENDED') {
        return res.status(403).json({
          error: 'Subscription has been suspended.',
          code: 'SUBSCRIPTION_SUSPENDED',
        });
      }

      // Attach subscription info to request
      req.subscription = status;
      next();
    } catch (error) {
      console.error('Subscription middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

const requirePlanFeature = (productKey, feature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const organizationId = req.params.organizationId || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const status = await subscriptionService.getSubscriptionStatus(organizationId, productKey);

      if (!status.isActive) {
        return res.status(403).json({
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
        });
      }

      // Check if plan has the feature
      const plan = status.plan;
      if (!plan || !plan.features || !plan.features.includes(feature)) {
        return res.status(403).json({
          error: `Feature "${feature}" not available on your current plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          plan: plan?.name || 'Unknown',
        });
      }

      next();
    } catch (error) {
      console.error('Plan feature middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

const requirePlanLimit = (productKey, limitKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const organizationId = req.params.organizationId || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const status = await subscriptionService.getSubscriptionStatus(organizationId, productKey);

      if (!status.isActive) {
        return res.status(403).json({
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
        });
      }

      // Check if plan has the limit
      const plan = status.plan;
      if (!plan || !plan.limits || plan.limits[limitKey] === undefined) {
        return res.status(403).json({
          error: `Limit "${limitKey}" not defined for your current plan`,
          code: 'LIMIT_NOT_DEFINED',
        });
      }

      // Attach limit value to request
      req.limit = plan.limits[limitKey];
      next();
    } catch (error) {
      console.error('Plan limit middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export default {
  requireActiveSubscription,
  requirePlanFeature,
  requirePlanLimit,
};