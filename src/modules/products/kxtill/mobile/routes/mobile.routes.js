// src/modules/products/kxtill/mobile/routes/mobile.routes.js
//
// KxTill Mobile endpoints. Purpose-built payloads for the mobile app.
// Mounted inside kxtill.routes.js at:
//
//   /api/v1/organizations/:organizationId/kxtill/mobile/*
//
// Every route below runs:
//   1. authMiddleware.authenticate  (inherited from parent router)
//   2. subscription guard           (inherited from parent router)
//   3. attachContext                (this router)
//
// attachContext resolves organization + membership + optional branch
// and exposes `can(key)` and `permissions()` on req.mobileContext.

import express from 'express';
import { attachContext } from '../common/context.js';
import dashboardController from '../controllers/dashboard.controller.js';
import branchesController from '../controllers/branches.controller.js';
import notificationsController from '../controllers/notifications.controller.js';
import devicesController from '../controllers/devices.controller.js';

const router = express.Router({ mergeParams: true });

// Every mobile route needs context. Attach once, use everywhere.
router.use(attachContext);

// ============================================================
// DASHBOARD
// ============================================================
//
// Composes the mobile dashboard from the existing report service.
// Every section is gated by the caller's permissions and scope.
// Sections the caller cannot see return null, not empty objects,
// so the mobile app can hide them cleanly.
//
// Query params:
//   branchId  (optional) — filter to one branch. Omit for org-wide
//                          when the caller has that scope.
//
router.get('/dashboard', dashboardController.getDashboard);

// 
router.get('/branches', branchesController.getBranches);
router.get('/branches/:branchId', branchesController.getBranchDetail);
router.get('/branches/:branchId/sales', branchesController.getBranchSales);
router.get('/branches/:branchId/stock', branchesController.getBranchStock);
router.get('/branches/:branchId/shifts', branchesController.getBranchShifts);
router.post('/branches/:branchId/shifts/:shiftId/review', branchesController.postReviewShift);
router.post('/branches/:branchId/shifts/:shiftId/force-close', branchesController.postForceCloseShift);

// ============================================================
// NOTIFICATIONS
// ============================================================
router.get('/notifications', notificationsController.list);
router.get('/notifications/unread-count', notificationsController.unreadCount);
router.get('/notifications/:id', notificationsController.detail);
router.patch('/notifications/:id/read', notificationsController.markRead);
router.post('/notifications/mark-all-read', notificationsController.markAllRead);
router.post('/notifications/seed', notificationsController.seed);
router.post('/devices/register', devicesController.register);
router.delete('/devices/:token', devicesController.unregister);

export default router;