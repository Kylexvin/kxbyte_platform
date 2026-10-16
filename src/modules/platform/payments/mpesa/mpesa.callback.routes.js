import express from 'express';
import mpesaStkController from './mpesa.stk.controller.js';

const router = express.Router();

// Safaricom POSTs here. Token in the URL identifies the org.
router.post('/:token', mpesaStkController.handleCallback);

export default router;