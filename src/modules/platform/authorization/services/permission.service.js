// src/modules/platform/authorization/services/permission.service.js

import permissionDb from '../db/permission.db.js';

const registerPermissions = async (productKey, permissions) => {
  if (!permissions || permissions.length === 0) {
    return [];
  }

  const results = [];
  for (const perm of permissions) {
    const data = {
      key: perm.key,
      name: perm.name,
      description: perm.description || '',
      productKey: productKey,
      isActive: true,
    };
    const result = await permissionDb.createPermission(data);
    results.push(result);
  }

  return results;
};

// Public list — excludes internal admin product
const listAllPermissions = async () => {
  return permissionDb.findAllPermissions();
};

// Internal use only — includes admin product (KxOS role management)
const listAllPermissionsIncludingInternal = async () => {
  return permissionDb.findAllPermissionsIncludingInternal();
};

const listPermissionsByProduct = async (productKey) => {
  return permissionDb.findPermissionsByProduct(productKey);
};

const getPermissionByKey = async (key) => {
  const permission = await permissionDb.findPermissionByKey(key);
  if (!permission) {
    throw new Error('Permission not found');
  }
  return permission;
};

const deletePermission = async (key) => {
  return permissionDb.deletePermission(key);
};

export default {
  registerPermissions,
  listAllPermissions,
  listAllPermissionsIncludingInternal,
  listPermissionsByProduct,
  getPermissionByKey,
  deletePermission,
};