// src/modules/platform/payments/mpesa/mpesa.config.routes.js

import express from 'express';
import mpesaConfigController from './mpesa.config.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

router.get('/', mpesaConfigController.getMpesaConfig);
router.post('/', mpesaConfigController.saveMpesaConfig);
router.delete('/', mpesaConfigController.deleteMpesaConfig);
router.post('/test', mpesaConfigController.testMpesaConfig);

export default router;