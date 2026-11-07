// src/modules/products/admin/routes/admin.routes.js
import express from 'express';
import authMiddleware from '../../../platform/identity/middleware/auth.middleware.js';
import { requirePlatformAdmin, hasPlatformPermission } from '../middleware/requirePlatformAdmin.middleware.js';

import * as dashboard from '../controllers/dashboard.controller.js';
import * as users from '../controllers/users.controller.js';
import * as orgs from '../controllers/organizations.controller.js';
import * as subs from '../controllers/subscriptions.controller.js';
import * as revenue from '../controllers/revenue.controller.js';
import * as alerts from '../controllers/alerts.controller.js';
import * as productsCtrl from '../controllers/products.controller.js';
import * as auditCtrl from '../controllers/audit.controller.js';

import orgCtrl from '../../../platform/organizations/controllers/org.controller.js';
import invitationCtrl from '../../../platform/organizations/controllers/invitation.controller.js';
import roleDb from '../../../platform/authorization/db/role.db.js';


import roleCtrl from '../../../platform/authorization/controllers/role.controller.js';
import permissionDb from '../../../platform/authorization/db/permission.db.js';



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
  requirePlatformAdmin('admin.users.view'),
  hasPlatformPermission('admin.users.sessions.view'),
  users.getOne);

router.post('/users/:userId/deactivate',
  requirePlatformAdmin('admin.users.manage'), users.deactivate);

router.post('/users/:userId/reactivate',
  requirePlatformAdmin('admin.users.manage'), users.reactivate);

router.post('/users/:userId/resend-verification',
  requirePlatformAdmin('admin.users.manage'), users.resendVerification);

router.post('/users/:userId/force-logout',
  requirePlatformAdmin('admin.users.manage'), users.forceLogout);
// ============================================================
// TEAM (kxbyte internal staff) — aliases over organization controllers
// ============================================================

const withInternalOrg = (handler) => (req, res, next) => {
  req.params = {
    ...req.params,
    id: req.internalOrgId,
    organizationId: req.internalOrgId,
  };
  return handler(req, res, next);
};

router.get(
  '/team/roles',
  requirePlatformAdmin('admin.members.view'),
  async (req, res) => {
    try {
      const roles = await roleDb.findRolesByOrganization(req.internalOrgId);
      res.status(200).json({ roles });
    } catch (err) {
      console.error('List team roles error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/team/invitations',
  requirePlatformAdmin('admin.members.view'),
  withInternalOrg(invitationCtrl.getOrganizationInvitations)
);

router.post(
  '/team/invitations',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrg(invitationCtrl.sendInvitation)
);

router.post(
  '/team/invitations/:invitationId/resend',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrg(invitationCtrl.resendInvitation)
);

router.delete(
  '/team/invitations/:invitationId',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrg(invitationCtrl.revokeInvitation)
);

router.get(
  '/team',
  requirePlatformAdmin('admin.members.view'),
  withInternalOrg(orgCtrl.getMembers)
);

router.patch(
  '/team/:memberId/role',
  requirePlatformAdmin('admin.members.manage'),
  (req, res, next) => {
    req.params.id = req.internalOrgId;
    next();
  },
  orgCtrl.updateMemberRole
);

router.delete(
  '/team/:memberId',
  requirePlatformAdmin('admin.members.manage'),
  (req, res, next) => {
    req.params.id = req.internalOrgId;
    next();
  },
  orgCtrl.removeMember
);

// ============================================================
// TEAM — permissions catalog (admin-inclusive)
// ============================================================
router.get(
  '/team/permissions',
  requirePlatformAdmin('admin.members.view'),
  async (req, res) => {
    try {
      const all = await permissionDb.findAllPermissionsIncludingInternal();
      // Staff roles: admin (kxbyte internal) + platform (org-wide, not product-specific)
      const permissions = all.filter((p) =>
        p.productKey === 'admin' || p.productKey === 'platform'
      );
      res.status(200).json({ permissions });
    } catch (err) {
      console.error('List admin permissions error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ============================================================
// TEAM — role CRUD (aliases over authorization role controller)
// ============================================================
const withInternalOrgParams = (handler) => (req, res, next) => {
  req.params = {
    ...req.params,
    organizationId: req.internalOrgId,
  };
  return handler(req, res, next);
};

router.post(
  '/team/roles',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrgParams(roleCtrl.createRole)
);

router.get(
  '/team/roles/:roleId',
  requirePlatformAdmin('admin.members.view'),
  withInternalOrgParams(roleCtrl.getRole)
);

router.patch(
  '/team/roles/:roleId',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrgParams(roleCtrl.updateRole)
);

router.delete(
  '/team/roles/:roleId',
  requirePlatformAdmin('admin.members.manage'),
  withInternalOrgParams(roleCtrl.deleteRole)
);

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