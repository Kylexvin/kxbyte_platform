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
import customerController from '../controllers/customer.controller.js';
import branchController from '../controllers/branch.controller.js';
import authMiddleware from '../../../platform/identity/middleware/auth.middleware.js';
import subscriptionMiddleware from '../../../platform/subscriptions/middleware/subscription.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Subscription guard for KxTill
const guard = subscriptionMiddleware.requireActiveSubscription('kxtill');

// ============================================================
// PRODUCT ROUTES
// ============================================================
router.post('/products', guard, productController.createProduct);
router.get('/products', guard, productController.getProducts);
router.post('/products/bulk', guard, productController.bulkCreateProducts);
router.get('/products/search', guard, productController.searchProducts);
router.get('/products/barcode/:barcode', guard, productController.getProductByBarcode);

router.patch('/products/:productId/units/:unitId', guard, productController.updateProductUnit);
router.get('/products/:productId', guard, productController.getProduct);
router.patch('/products/:productId', guard, productController.updateProduct);
router.delete('/products/:productId', guard, productController.deleteProduct);
router.patch('/branches/:branchId/products/:productId', guard, productController.updateBranchProduct);

// ============================================================
// BRANCH PRODUCT ROUTES
// ============================================================
router.get('/branches/:branchId/products', guard, productController.getBranchProducts);
router.patch('/branches/:branchId/products/:productId/stock', guard, productController.updateBranchProductStock);
router.delete('/branches/:branchId/products/:productId', guard, productController.removeBranchProduct);
router.patch('/branches/:branchId/products/:productId', guard, productController.updateBranchProduct);

// ============================================================
// BRANCH ROUTES
// ============================================================
router.get('/branches', guard, branchController.getBranches);
router.get('/branches/:branchId', guard, branchController.getBranchOverview);

// ============================================================
// SALE ROUTES
// ============================================================
router.post('/sales', guard, saleController.createSale);
router.post('/sales/offline', guard, saleController.createOfflineSale);
router.get('/sales', guard, saleController.getSales);
router.get('/sales/:saleId', guard, saleController.getSale);
router.post('/sales/:saleId/refund', guard, saleController.refundSale);
router.get('/sales/:saleId/receipt', guard, receiptController.generateReceipt);

// ============================================================
// SYNC ROUTES
// ============================================================
router.get('/sync/products', guard, productController.getProductsForSync);
router.get('/sync/branch-products', guard, productController.getBranchProductsForSync);

// ============================================================
// TRANSFER ROUTES
// ============================================================
router.get('/transfers/stats', guard, transferController.getTransferStats);
router.get('/transfers/form-data', guard, transferController.getTransferFormData);
router.post('/transfers', guard, transferController.createTransfer);
router.get('/transfers', guard, transferController.getTransfers);
router.get('/transfers/:transferId', guard, transferController.getTransfer);
router.patch('/transfers/:transferId/approve', guard, transferController.approveTransfer);
router.patch('/transfers/:transferId/complete', guard, transferController.completeTransfer);
router.patch('/transfers/:transferId/reject', guard, transferController.rejectTransfer);

// ============================================================
// STAFF ROUTES
// ============================================================
router.get('/staff', guard, staffController.getStaff);
router.patch('/staff/:targetUserId', guard, staffController.updateStaff);
router.delete('/staff/:targetUserId', guard, staffController.removeStaff);

// ============================================================
// SETTINGS
// ============================================================
router.get('/settings', guard, settingController.getSettings);
router.patch('/settings', guard, settingController.updateSettings);

// ============================================================
// DASHBOARD ROUTES (reads)
// ============================================================
router.get('/dashboard/summary', guard, reportController.getDashboardSummary);
router.get('/dashboard/sales-chart', guard, reportController.getSalesChart);
router.get('/dashboard/top-products', guard, reportController.getTopProducts);
router.get('/dashboard/recent-sales', guard, reportController.getRecentSales);
router.get('/dashboard/today-sales', guard, reportController.getTodaySales);
router.get('/dashboard/payment-methods', guard, reportController.getPaymentMethodDistribution);
router.get('/dashboard/branch-breakdown', guard, reportController.getBranchBreakdown);
router.get('/dashboard/returns-summary', guard, reportController.getReturnsSummary);
router.get('/dashboard/low-stock', guard, reportController.getLowStock);
router.get('/dashboard/branch-overview', guard, reportController.getBranchOverview);
router.get('/dashboard/inventory-alerts', guard, reportController.getInventoryAlerts);
router.get('/inventory/summary', guard, reportController.getInventorySummary);
router.get('/inventory/health', guard, reportController.getInventoryHealth);
router.get('/inventory/needs-attention', guard, reportController.getNeedsAttention);
router.get('/inventory/activity', guard, reportController.getStockActivity);
router.get('/inventory/branches', guard, reportController.getBranchStock);
router.get('/dashboard/profit', guard, reportController.getProfit);
router.get('/dashboard/today-stats', guard, reportController.getTodayStats);
router.get('/dashboard/sales-trend', guard, reportController.getSalesTrend);
router.get('/dashboard/today-sales-trend', guard, reportController.getTodaySalesTrend);

// ============================================================
// EXPORTS ROUTES (reads)
// ============================================================
router.get('/reports/export/sales', guard, exportController.exportSales);
router.get('/reports/export/stock', guard, exportController.exportStock);
router.get('/reports/export/top-products', guard, exportController.exportTopProducts);
router.get('/reports/export/branches', guard, exportController.exportBranchPerformance);
router.get('/reports/export/tax', guard, exportController.exportTax);
router.get('/reports/export/audit', guard, exportController.exportAudit);

// ============================================================
// CUSTOMER ROUTES
// ============================================================
router.get('/customers/sync', guard, customerController.getCustomersForSync);
router.post('/customers/sync', guard, customerController.syncOfflineCustomers);
router.get('/customers', guard, customerController.getCustomers);
router.post('/customers', guard, customerController.createCustomer);
router.patch('/customers/:customerId', guard, customerController.updateCustomer);
router.delete('/customers/:customerId', guard, customerController.deleteCustomer);
router.get('/customers/:customerId', guard, customerController.getCustomer);
router.get('/customers/:customerId/sales', guard, customerController.getCustomerSales);

export default router; 