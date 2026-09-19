// src/modules/products/admin/routes/admin.routes.js
import express from 'express';
import authMiddleware from '../../../platform/identity/middleware/auth.middleware.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.middleware.js';

import * as dashboard from '../controllers/dashboard.controller.js';
import * as users from '../controllers/users.controller.js';
import * as orgs from '../controllers/organizations.controller.js';
import * as subs from '../controllers/subscriptions.controller.js';
import * as revenue from '../controllers/revenue.controller.js';
import * as alerts from '../controllers/alerts.controller.js';
import * as productsCtrl from '../controllers/products.controller.js';
import * as auditCtrl from '../controllers/audit.controller.js';

const router = express.Router();

router.use(authMiddleware.authenticate);

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard',
  requirePlatformAdmin('admin.dashboard.view'), dashboard.get);

// ============================================================
// ALERTS
// ============================================================
router.get('/alerts',
  requirePlatformAdmin('admin.dashboard.view'), alerts.list);

//
router.get(
  '/organizations/:organizationId/audit-logs',
  requirePlatformAdmin('admin.audit.view'),
  auditCtrl.listForOrg
);

// ============================================================
// USERS
// ============================================================
router.get('/users',
  requirePlatformAdmin('admin.users.view'), users.list);

router.get('/users/:userId',
  requirePlatformAdmin('admin.users.view'), users.getOne);

// ============================================================
// ORGANIZATIONS
// ============================================================
router.get('/organizations',
  requirePlatformAdmin('admin.organizations.view'), orgs.list);

router.get('/organizations/:orgId',
  requirePlatformAdmin('admin.organizations.view'), orgs.getOne);

router.post('/organizations/:orgId/activate',
  requirePlatformAdmin('admin.organizations.manage'), orgs.activate);

router.post('/organizations/:orgId/suspend',
  requirePlatformAdmin('admin.organizations.manage'), orgs.suspend);

router.post('/organizations/:orgId/archive',
  requirePlatformAdmin('admin.organizations.manage'), orgs.archive);

router.post('/organizations/:orgId/unarchive',
  requirePlatformAdmin('admin.organizations.manage'), orgs.unarchive);

// ============================================================
// SUBSCRIPTIONS
// ============================================================
router.get('/subscriptions',
  requirePlatformAdmin('admin.subscriptions.view'), subs.list);

router.get('/subscriptions/:organizationId/:productKey',
  requirePlatformAdmin('admin.subscriptions.view'), subs.getOne);

router.post('/subscriptions/:organizationId/:productKey/renew',
  requirePlatformAdmin('admin.subscriptions.renew'), subs.renew);

router.patch('/subscriptions/:organizationId/:productKey/dates',
  requirePlatformAdmin('admin.subscriptions.setDates'), subs.setDates);

router.patch('/subscriptions/:organizationId/:productKey/status',
  requirePlatformAdmin('admin.subscriptions.setStatus'), subs.setStatus);

router.post('/subscriptions/:organizationId/:productKey/suspend',
  requirePlatformAdmin('admin.subscriptions.suspend'), subs.suspend);

router.post('/subscriptions/:organizationId/:productKey/extend-trial',
  requirePlatformAdmin('admin.subscriptions.setDates'), subs.extendTrial);

// ============================================================
// REVENUE
// ============================================================
router.get('/revenue/summary',
  requirePlatformAdmin('admin.payments.view'), revenue.summary);

router.get('/revenue/payments',
  requirePlatformAdmin('admin.payments.view'), revenue.list);

// ============================================================
// PRODUCTS
// ============================================================
router.get('/products',
  requirePlatformAdmin('admin.organizations.view'), productsCtrl.list);

router.get('/products/:key',
  requirePlatformAdmin('admin.organizations.view'), productsCtrl.getOne);

export default router;