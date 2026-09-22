// src/modules/platform/subscriptions/routes/subscription.routes.js

import express from 'express';
import subscriptionController from '../controllers/subscription.controller.js';
import trialController from '../controllers/trial.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Static routes first
router.get('/plans', subscriptionController.listPlans);
router.get('/trial-burns', trialController.getTrialBurns);

// Organization subscription routes
router.get('/', subscriptionController.getOrganizationSubscriptions);
router.get('/:productKey', subscriptionController.getSubscription);
router.get('/:productKey/status', subscriptionController.getSubscriptionStatus);
router.post('/:productKey', subscriptionController.createSubscription);
router.delete('/:productKey', subscriptionController.cancelSubscription);
router.post('/:productKey/renew', subscriptionController.renewSubscription);
router.post('/:productKey/pay', subscriptionController.paySubscription);

export default router;