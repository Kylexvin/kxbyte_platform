// src/modules/products/kxtill/mobile/common/context.js
//
// Per-request context for KxTill Mobile endpoints.
//
// Follows the module layering of other kxtill services:
//   orgDb                  → organization + membership
//   branchDb               → branch lookup (scoped to org)
//   authorizationService   → permissions (single source of truth)
//
// Exposes two ways to interrogate permissions:
//   can(key)          → boolean, single permission
//   permissions()     → string[], the full set for the current org
//
// Callers that need a whole permission list (e.g. the dashboard)
// use permissions() once. Callers that gate a single section use
// can(key). Neither caches — a permission change is picked up on
// the next request.

import orgDb from '../../../../platform/organizations/db/org.db.js';
import branchDb from '../../../../platform/branches/db/branch.db.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';

const BRANCH_QUERY_KEYS = ['branchId', 'branch'];

export async function buildContext(req) {
  const userId = req.user?.userId;
  if (!userId) {
    throw makeErr(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const organizationId = req.params?.organizationId || null;
  if (!organizationId) {
    throw makeErr(400, 'MISSING_ORG', 'organizationId is required');
  }

  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw makeErr(404, 'ORG_NOT_FOUND', 'Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw makeErr(
      403,
      'NOT_A_MEMBER',
      'You are not a member of this organization'
    );
  }

  // Optional branch scope from query.
  let branchId = null;
  for (const k of BRANCH_QUERY_KEYS) {
    const v = req.query?.[k];
    if (typeof v === 'string' && v.trim()) {
      branchId = v.trim();
      break;
    }
  }

  let branch = null;
  if (branchId) {
    branch = await branchDb.findBranchById(branchId, organizationId);
    if (!branch) {
      throw makeErr(
        403,
        'BRANCH_FORBIDDEN',
        'You do not have access to that branch'
      );
    }
  }

  const can = (key) =>
    authorizationService.checkPermission(userId, organizationId, key);

  const permissions = () =>
    authorizationService.getAllUserPermissions(userId, organizationId);

  const user = {
    id: userId,
    email: req.user?.email || null,
  };

  return {
    user,
    organizationId,
    organization,
    membership,
    branchId,
    branch,
    can,          // async (key) => boolean
    permissions,  // async () => string[]
  };
}

export async function attachContext(req, res, next) {
  try {
    req.mobileContext = await buildContext(req);
    next();
  } catch (e) {
    const status = e.status || 500;
    const code = e.code || 'INTERNAL';
    res.status(status).json({ code, message: e.message });
  }
}

function makeErr(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

export default { buildContext, attachContext };