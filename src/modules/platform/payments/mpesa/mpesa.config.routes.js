import express from 'express';
import mpesaConfigController from './mpesa.config.controller.js';
import mpesaStkController from './mpesa.stk.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Config
router.get('/', mpesaConfigController.getMpesaConfig);
router.post('/', mpesaConfigController.saveMpesaConfig);
router.delete('/', mpesaConfigController.deleteMpesaConfig);
router.post('/test', mpesaConfigController.testMpesaConfig);

// STK Push
router.post('/stk-push', mpesaStkController.initiateStkPush);
router.get('/transactions/:merchantRef', mpesaStkController.getTransaction);

export default router;