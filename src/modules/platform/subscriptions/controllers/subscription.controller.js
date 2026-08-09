// src/modules/platform/subscriptions/controllers/subscription.controller.js

import subscriptionService from '../services/subscription.service.js';
import planService from '../services/plan.service.js';
import subscriptionValidator from '../validators/subscription.validator.js';
import orgDb from '../../organizations/db/org.db.js'; 

// ============================================================
// PLAN CONTROLLERS
// ============================================================

const listPlans = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productKey } = req.query;
    let plans;
    if (productKey) {
      plans = await planService.getPlansByProduct(productKey);
    } else {
      plans = await planService.getAllPlans();
    }

    res.status(200).json({ plans });
  } catch (error) {
    console.error('List plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// SUBSCRIPTION CONTROLLERS
// ============================================================

const createSubscription = async (req, res) => {
  const validation = subscriptionValidator.validateCreateSubscription(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { planKey } = req.body;

    // Check if user is owner
    const organization = await orgDb.findOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the organization owner can manage subscriptions' });
    }

    const subscription = await subscriptionService.createSubscription(
      organizationId,
      organizationId, // productKey will be derived from plan
      planKey
    );

    res.status(201).json({ subscription });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Plan not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Subscription already exists for this product') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSubscription = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    const subscription = await subscriptionService.getSubscription(organizationId, productKey);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.status(200).json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const paySubscription = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    // Check if user is owner
    const organization = await orgDb.findOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the organization owner can pay for subscriptions' });
    }

    const result = await subscriptionService.initiateSubscriptionPayment(
      organizationId,
      productKey,
      userId
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Subscription not found' || error.message === 'Plan not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Pay subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrganizationSubscriptions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    // Check access
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const subscriptions = await subscriptionService.getOrganizationSubscriptions(organizationId);
    res.status(200).json({ subscriptions });
  } catch (error) {
    console.error('Get organization subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    const status = await subscriptionService.getSubscriptionStatus(organizationId, productKey);
    res.status(200).json(status);
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    // Check if user is owner
    const organization = await orgDb.findOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the organization owner can cancel subscriptions' });
    }

    const subscription = await subscriptionService.cancelSubscription(organizationId, productKey);
    res.status(200).json({ message: 'Subscription cancelled', subscription });
  } catch (error) {
    if (error.message === 'Subscription not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const renewSubscription = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    const organization = await orgDb.findOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (organization.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the organization owner can renew subscriptions' });
    }

    const subscription = await subscriptionService.renewSubscription(organizationId, productKey);
    res.status(200).json({ message: 'Subscription renewed', subscription });
  } catch (error) {
    if (error.message === 'Subscription not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Renew subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  listPlans,
  createSubscription,
  getSubscription,
  getOrganizationSubscriptions,
  getSubscriptionStatus,
  cancelSubscription,
  renewSubscription,
  paySubscription,
};