// src/modules/platform/subscriptions/routes/org-billing.routes.js

import express from 'express';
import authMiddleware from '../../identity/middleware/auth.middleware.js';
import orgBillingController from '../controllers/org-billing.controller.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

router.get('/billing', orgBillingController.getBilling);
router.post('/billing/notify-payment', orgBillingController.notifyPayment);

export default router;