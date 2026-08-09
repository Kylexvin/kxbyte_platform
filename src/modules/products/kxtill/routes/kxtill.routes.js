// src/modules/products/kxtill/routes/kxtill.routes.js

import express from 'express';
import productController from '../controllers/product.controller.js';
import saleController from '../controllers/sale.controller.js';
import authMiddleware from '../../../platform/identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Product routes
router.get('/products/low-stock', productController.getLowStockProducts);
router.post('/products', productController.createProduct);
router.get('/products', productController.getProducts);
router.get('/products/:productId', productController.getProduct);
router.patch('/products/:productId', productController.updateProduct);
router.delete('/products/:productId', productController.deleteProduct);

// Sale routes
router.post('/sales', saleController.createSale);
router.get('/sales', saleController.getSales);
router.get('/sales/:saleId', saleController.getSale);
router.post('/sales/:saleId/refund', saleController.refundSale);

export default router;