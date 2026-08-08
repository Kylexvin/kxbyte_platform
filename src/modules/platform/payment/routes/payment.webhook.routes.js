// src/modules/platform/payment/routes/payment.webhook.routes.js

import express from 'express';
import paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// IPN endpoint — NO AUTH (public)
router.get('/ipn', paymentController.handleIPN);
router.post('/ipn', paymentController.handleIPN);

export default router;