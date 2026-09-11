// src/modules/platform/customers/routes/customer.routes.js

import express from 'express';
import customerController from '../controllers/customer.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

router.post('/', customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:customerId', customerController.getCustomer);
router.patch('/:customerId', customerController.updateCustomer);
router.delete('/:customerId', customerController.deleteCustomer);

export default router;