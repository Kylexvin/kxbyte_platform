import express from 'express';
import subscriberController from './subscriber.controller.js';

const router = express.Router();

// POST /api/v1/public/subscribe — public, no auth
router.post('/public/subscribe', subscriberController.subscribe);

export default router;