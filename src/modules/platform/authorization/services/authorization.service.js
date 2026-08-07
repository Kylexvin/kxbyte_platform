// src/modules/platform/authorization/services/authorization.service.js

import roleDb from '../db/role.db.js';
import permissionDb from '../db/permission.db.js';
import orgDb from '../../organizations/db/org.db.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  // 1. Check if user is owner
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    return false;
  }

  if (organization.ownerId === userId) {
    return true; // Owner has full access
  }

  // 2. Get user's membership
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership || !membership.isActive) {
    return false;
  }

  // 3. Check if user has a role
  if (!membership.roleId) {
    return false;
  }

  // 4. Get role with permissions
  const role = await roleDb.findRoleById(membership.roleId);
  if (!role) {
    return false;
  }

  // 5. Check if role has the permission (with wildcard support)
  const rolePermissions = role.permissions || [];

  for (const rp of rolePermissions) {
    const permKey = rp.permission.key;
    if (matchPermission(permKey, permissionKey)) {
      return true;
    }
  }

  return false;
};

const matchPermission = (rolePermission, requiredPermission) => {
  // Exact match
  if (rolePermission === requiredPermission) {
    return true;
  }

  // Wildcard: product.*
  if (rolePermission.endsWith('.*')) {
    const product = rolePermission.replace('.*', '');
    if (requiredPermission.startsWith(product + '.')) {
      return true;
    }
  }

  // Wildcard: product.resource.*
  if (rolePermission.endsWith('.*')) {
    const prefix = rolePermission.replace('.*', '');
    if (requiredPermission.startsWith(prefix + '.')) {
      return true;
    }
  }

  // Super wildcard: *
  if (rolePermission === '*') {
    return true;
  }

  return false;
};

const checkPermissions = async (userId, organizationId, permissionKeys) => {
  const results = {};
  for (const key of permissionKeys) {
    results[key] = await checkPermission(userId, organizationId, key);
  }
  return results;
};

export default {
  checkPermission,
  checkPermissions,
  matchPermission,
};