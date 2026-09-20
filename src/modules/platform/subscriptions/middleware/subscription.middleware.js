// src/modules/platform/subscriptions/middleware/subscription.middleware.js

import subscriptionService from '../services/subscription.service.js';

// ============================================================
// READ vs WRITE INFERENCE
// ============================================================
// During GRACE, read operations pass, write operations block.
// We infer action from the last segment of the route path.
//   e.g. POST /sales              → 'sales'      → read?  no  (not in suffixes → read)
//   e.g. POST /products/create    → 'create'     → write
//   e.g. PUT  /products/:id       → 'id'         → read?  no  (falls back to read)
//
// To make this reliable, we ALSO honor req.method:
//   GET/HEAD/OPTIONS = read
//   POST/PUT/PATCH/DELETE = write (unless the last path segment ends with a read suffix)
// ============================================================

const READ_SUFFIXES = ['view', 'list', 'get', 'search', 'report', 'reports', 'export'];
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const inferAction = (req) => {
  // Method is authoritative for GET/HEAD
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return 'read';
  }

  const parts = (req.baseUrl + req.path).split('/').filter(Boolean);
  const last = (parts[parts.length - 1] || '').toLowerCase();

  // If the last segment explicitly says "view"/"list"/etc, treat as read
  // even if the method is POST (e.g. POST /sales/search).
  if (READ_SUFFIXES.some((s) => last.endsWith(s))) {
    return 'read';
  }

  // Otherwise, any non-GET is a write
  if (WRITE_METHODS.includes(req.method)) {
    return 'write';
  }

  return 'read';
};

// ============================================================
// requireActiveSubscription
// ============================================================

const requireActiveSubscription = (productKey) => {
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

      if (status.status === 'NONE') {
        return res.status(403).json({
          error: 'No subscription found for this product',
          code: 'NO_SUBSCRIPTION',
        });
      }

      // TRIAL and ACTIVE: full access
      if (status.status === 'TRIAL' || status.status === 'ACTIVE') {
        req.subscription = status;
        return next();
      }

      // GRACE: read-only window. Reads pass, writes block.
      if (status.status === 'GRACE') {
        const action = inferAction(req);
        if (action === 'write') {
          return res.status(403).json({
            error: 'Subscription in grace period. Read-only access.',
            code: 'SUBSCRIPTION_GRACE_READONLY',
            graceEnd: status.graceEnd,
          });
        }
        req.subscription = status;
        return next();
      }

     
      // EXPIRED: reads pass, writes block
      if (status.status === 'EXPIRED') {
        const action = inferAction(req);
        if (action === 'write') {
          return res.status(403).json({
            error: 'Subscription has expired. Please renew.',
            code: 'SUBSCRIPTION_EXPIRED',
            expiredAt: status.expiredAt,
          });
        }
        req.subscription = status;
        return next();
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

      // Unknown status — fail closed
      return res.status(403).json({
        error: 'Subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        status: status.status,
      });
    } catch (error) {
      console.error('Subscription middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// ============================================================
// requirePlanFeature
// ============================================================

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

      // Only TRIAL/ACTIVE unlock features
      if (status.status !== 'TRIAL' && status.status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
        });
      }

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

// ============================================================
// requirePlanLimit
// ============================================================

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

      if (status.status !== 'TRIAL' && status.status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
        });
      }

      const plan = status.plan;
      if (!plan || !plan.limits || plan.limits[limitKey] === undefined) {
        return res.status(403).json({
          error: `Limit "${limitKey}" not defined for your current plan`,
          code: 'LIMIT_NOT_DEFINED',
        });
      }

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