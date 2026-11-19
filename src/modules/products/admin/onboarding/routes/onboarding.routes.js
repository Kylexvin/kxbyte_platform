// src/modules/products/admin/onboarding/routes/onboarding.routes.js
//
// Mounted at /admin/onboarding by admin.routes.js.
// authMiddleware.authenticate runs at the parent router.

import express from 'express';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.middleware.js';
import * as ctrl from '../controllers/onboarding.controller.js';

const router = express.Router();

// List + detail
router.get(
  '/',
  requirePlatformAdmin('admin.onboarding.view'),
  ctrl.list
);
router.get(
  '/orgs',
  requirePlatformAdmin('admin.onboarding.view'),
  ctrl.listOrgs
);

router.post(
  '/start',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.start
);
router.get(
  '/stats',
  requirePlatformAdmin('admin.onboarding.view'),
  ctrl.getStats
);
router.get(
  '/:onboardingId',
  requirePlatformAdmin('admin.onboarding.view'),
  ctrl.getOne
);

// Owner
router.post(
  '/:onboardingId/owner',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.assignOwner
);

// Task mutations
router.post(
  '/:onboardingId/tasks/:taskId/complete',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.completeTask
);

router.post(
  '/:onboardingId/tasks/:taskId/ignore',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.ignoreTask
);

router.post(
  '/:onboardingId/tasks/:taskId/reopen',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.reopenTask
);

router.patch(
  '/:onboardingId/tasks/:taskId/due',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.setDueDate
);

router.patch(
  '/:onboardingId/tasks/:taskId/notes',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.setTaskNotes
);

// Ad-hoc tasks (org-scoped, not tied to a product onboarding)
router.post(
  '/orgs/:orgId/adhoc-tasks',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.addAdHoc
);

router.delete(
  '/orgs/:orgId/adhoc-tasks/:taskId',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.deleteAdHoc
);
router.post(
  '/orgs/:orgId/adhoc-tasks/:taskId/assign',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.assignAdHoc
);

router.post(
  '/orgs/:orgId/adhoc-tasks/:taskId/complete',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.completeAdHoc
);

router.post(
  '/orgs/:orgId/adhoc-tasks/:taskId/ignore',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.ignoreAdHoc
);

router.post(
  '/orgs/:orgId/adhoc-tasks/:taskId/reopen',
  requirePlatformAdmin('admin.onboarding.manage'),
  ctrl.reopenAdHoc
);
router.get(
  '/adhoc-tasks',
  requirePlatformAdmin('admin.onboarding.view'),
  ctrl.listAdHoc
);
export default router;