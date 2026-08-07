// src/modules/platform/products/routes/product.routes.js

import express from 'express';
import productController from '../controllers/product.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Product listing
router.get('/', productController.listAllProducts);

// Organization products
router.get('/organizations/:organizationId/products', productController.getOrganizationProducts);
router.post('/organizations/:organizationId/products/activate', productController.activateProduct);
router.delete('/organizations/:organizationId/products/:productKey', productController.deactivateProduct);
router.get('/organizations/:organizationId/products/:productKey', productController.getProductActivationStatus);

export default router;