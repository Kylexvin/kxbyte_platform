// src/modules/products/kxtill/routes/kxtill.routes.js

import express from 'express';
import productController from '../controllers/product.controller.js';
import saleController from '../controllers/sale.controller.js';
import reportController from '../controllers/report.controller.js';
import settingController from '../controllers/setting.controller.js';
import receiptController from '../controllers/receipt.controller.js';
import exportController from '../controllers/export.controller.js';
import transferController from '../transfer/controllers/transfer.controller.js';
import staffController from '../controllers/staff.controller.js';
import authMiddleware from '../../../platform/identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// ============================================================
// PRODUCT ROUTES
// ============================================================
// Static routes FIRST (no :param)
router.post('/products', productController.createProduct);
router.get('/products', productController.getProducts);
router.post('/products/bulk', productController.bulkCreateProducts);
router.get('/products/search', productController.searchProducts);
router.get('/products/barcode/:barcode', productController.getProductByBarcode);

// Dynamic routes LAST (with :param)
router.patch('/products/:productId/units/:unitId', productController.updateProductUnit);
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
router.post('/sales/offline', saleController.createOfflineSale);
router.get('/sales', saleController.getSales);
router.get('/sales/:saleId', saleController.getSale);
router.post('/sales/:saleId/refund', saleController.refundSale);
router.get('/sales/:saleId/receipt', receiptController.generateReceipt);
// ============================================================
// SYNC ROUTES (Offline-first)
// ============================================================
router.get('/sync/products', productController.getProductsForSync);
router.get('/sync/branch-products', productController.getBranchProductsForSync);
// ============================================================
// TRANSFER ROUTES
// ============================================================
// Static routes FIRST
router.get('/transfers/stats', transferController.getTransferStats);
router.get('/transfers/form-data', transferController.getTransferFormData);

// Dynamic routes LAST
router.post('/transfers', transferController.createTransfer);
router.get('/transfers', transferController.getTransfers);
router.get('/transfers/:transferId', transferController.getTransfer);
router.patch('/transfers/:transferId/approve', transferController.approveTransfer);
router.patch('/transfers/:transferId/complete', transferController.completeTransfer);
router.patch('/transfers/:transferId/reject', transferController.rejectTransfer);

// ============================================================
// STAFF ROUTES
// ============================================================
router.get('/staff', staffController.getStaff);
router.patch('/staff/:targetUserId', staffController.updateStaff);
router.delete('/staff/:targetUserId', staffController.removeStaff);

// ============================================================
// SETTINGS
// ============================================================
router.get('/settings', settingController.getSettings);
router.patch('/settings', settingController.updateSettings);

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

// Today's sales
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

// Inventory Dashboard routes
router.get('/inventory/summary', reportController.getInventorySummary);
router.get('/inventory/health', reportController.getInventoryHealth);
router.get('/inventory/needs-attention', reportController.getNeedsAttention);
router.get('/inventory/activity', reportController.getStockActivity);
router.get('/inventory/branches', reportController.getBranchStock);

// ============================================================
// EXPORTS ROUTES
// ============================================================
router.get('/reports/export/sales', exportController.exportSales);
router.get('/reports/export/stock', exportController.exportStock);
router.get('/reports/export/top-products', exportController.exportTopProducts);
router.get('/reports/export/branches', exportController.exportBranchPerformance);
router.get('/reports/export/tax', exportController.exportTax);
router.get('/reports/export/audit', exportController.exportAudit);

export default router;