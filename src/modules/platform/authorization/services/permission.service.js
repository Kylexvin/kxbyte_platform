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

const listAllPermissions = async () => {
  return permissionDb.findAllPermissions();
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
  listPermissionsByProduct,
  getPermissionByKey,
  deletePermission,
};