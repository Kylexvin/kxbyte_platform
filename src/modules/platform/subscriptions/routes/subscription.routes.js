// src/modules/platform/subscriptions/routes/subscription.routes.js

import express from 'express';
import subscriptionController from '../controllers/subscription.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// Plan routes
router.get('/plans', subscriptionController.listPlans);

// Organization subscription routes
router.get('/', subscriptionController.getOrganizationSubscriptions);
router.post('/:productKey', subscriptionController.createSubscription);
router.get('/:productKey', subscriptionController.getSubscription);
router.get('/:productKey/status', subscriptionController.getSubscriptionStatus);
router.delete('/:productKey', subscriptionController.cancelSubscription);
router.post('/:productKey/renew', subscriptionController.renewSubscription);
router.post('/:productKey/pay', subscriptionController.paySubscription); 


export default router;