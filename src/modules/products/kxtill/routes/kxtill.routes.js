// src/modules/products/kxtill/routes/kxtill.routes.js

import express from 'express';
import productController from '../controllers/product.controller.js';
import saleController from '../controllers/sale.controller.js';
import reportController from '../controllers/report.controller.js';
import settingController from '../controllers/setting.controller.js';
import receiptController from '../controllers/receipt.controller.js';
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

// ============================================================
// BRANCH PRODUCT ROUTES
// ============================================================

router.get('/branches/:branchId/products', productController.getBranchProducts);
router.patch('/branches/:branchId/products/:productId/stock', productController.updateBranchProductStock);

// Sale routes
router.post('/sales', saleController.createSale);
router.get('/sales', saleController.getSales);
router.get('/sales/:saleId', saleController.getSale);
router.post('/sales/:saleId/refund', saleController.refundSale);

// Report routes
router.get('/dashboard/summary', reportController.getDashboardSummary);
router.get('/dashboard/sales-chart', reportController.getSalesChart);
router.get('/dashboard/top-products', reportController.getTopProducts);
router.get('/dashboard/low-stock', reportController.getLowStock);
router.get('/dashboard/recent-sales', reportController.getRecentSales);

// Store settings routes
router.get('/settings', settingController.getSettings);
router.patch('/settings', settingController.updateSettings);

// Receipt routes
router.get('/sales/:saleId/receipt', receiptController.generateReceipt);

export default router;