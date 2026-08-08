// src/modules/platform/payment/routes/payment.routes.js

import express from 'express';
import paymentController from '../controllers/payment.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// Merchant configuration
router.post('/config', paymentController.configureMerchant);
router.get('/config', paymentController.getMerchantConfig);

// IPN registration
router.post('/ipn/register', paymentController.registerIPN);

// Payment
router.post('/initiate', paymentController.initiatePayment);

// Transaction status
router.get('/transactions/:orderTrackingId', paymentController.getTransactionStatus);

export default router;