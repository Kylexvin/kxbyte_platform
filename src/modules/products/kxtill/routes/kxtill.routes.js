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

// ============================================================
// PRODUCT ROUTES (Organization-level)
// ============================================================
router.post('/products', productController.createProduct);
router.get('/products', productController.getProducts);
router.get('/products/:productId', productController.getProduct);
router.patch('/products/:productId', productController.updateProduct);
router.delete('/products/:productId', productController.deleteProduct);

// ============================================================
// BRANCH PRODUCT ROUTES (Branch-level inventory)
// ============================================================
router.get('/branches/:branchId/products', productController.getBranchProducts);
router.patch('/branches/:branchId/products/:productId/stock', productController.updateBranchProductStock);

// ============================================================
// SALE ROUTES
// ============================================================
router.post('/sales', saleController.createSale);
router.get('/sales', saleController.getSales);
router.get('/sales/:saleId', saleController.getSale);
router.post('/sales/:saleId/refund', saleController.refundSale);
router.get('/sales/:saleId/receipt', receiptController.generateReceipt);

// ============================================================
// DASHBOARD ROUTES
// ============================================================
// Summary
router.get('/dashboard/summary', reportController.getDashboardSummary);

// Sales chart
router.get('/dashboard/sales-chart', reportController.getSalesChart);

// Top products (branch-aware)
router.get('/dashboard/top-products', reportController.getTopProducts);

// Recent sales
router.get('/dashboard/recent-sales', reportController.getRecentSales);

// Todays's sales
router.get('/dashboard/today-sales', reportController.getTodaySales);
router.get('/dashboard/payment-methods', reportController.getPaymentMethodDistribution);
router.get('/dashboard/branch-breakdown', reportController.getBranchBreakdown);
router.get('/dashboard/returns-summary', reportController.getReturnsSummary);

// Low stock (branch-aware)
router.get('/dashboard/low-stock', reportController.getLowStock);


// Branch overview
router.get('/dashboard/branch-overview', reportController.getBranchOverview);

// Inventory alerts (branch-aware)
router.get('/dashboard/inventory-alerts', reportController.getInventoryAlerts);

// ============================================================
// SETTINGS
// ============================================================
router.get('/settings', settingController.getSettings);
router.patch('/settings', settingController.updateSettings);

export default router;