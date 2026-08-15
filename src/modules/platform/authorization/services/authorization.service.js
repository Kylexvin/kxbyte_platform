// src/modules/platform/authorization/services/authorization.service.js

import roleDb from '../db/role.db.js';
import permissionDb from '../db/permission.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';

// ============================================================
// USER PERMISSIONS
// ============================================================

const getAllUserPermissions = async (userId, organizationId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    return [];
  }

  // Owner has all permissions → return ["*"]
  if (organization.ownerId === userId) {
    return ["*"];
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership || !membership.isActive || !membership.roleId) {
    return [];
  }

  const role = await roleDb.findRoleById(membership.roleId);
  if (!role) {
    return [];
  }

  const rolePermissions = role.permissions || [];
  return rolePermissions.map(rp => rp.permission.key);
};

const checkPermission = async (userId, organizationId, permissionKey) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    return false;
  }

  if (organization.ownerId === userId) {
    return true;
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership || !membership.isActive) {
    return false;
  }

  if (!membership.roleId) {
    return false;
  }

  const role = await roleDb.findRoleById(membership.roleId);
  if (!role) {
    return false;
  }

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
  if (rolePermission === requiredPermission) {
    return true;
  }

  if (rolePermission.endsWith('.*')) {
    const prefix = rolePermission.replace('.*', '');
    if (requiredPermission.startsWith(prefix + '.')) {
      return true;
    }
  }

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

// ============================================================
// ROLE MANAGEMENT — WITH AUDIT LOGS 
// ============================================================

const createRole = async (organizationId, userId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  const existing = await roleDb.findRoleByOrgAndName(organizationId, data.name);
  if (existing) {
    throw new Error('A role with this name already exists');
  }

  const role = await roleDb.createRole({
    organizationId,
    name: data.name,
    description: data.description || '',
  });

  // Audit log: Role created
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ROLE_CREATED',
    resource: 'role',
    resourceId: role.id,
    metadata: {
      name: role.name,
      description: role.description,
    },
  });

  return role;
};

const updateRole = async (organizationId, userId, roleId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  if (data.name && data.name !== role.name) {
    const existing = await roleDb.findRoleByOrgAndName(organizationId, data.name);
    if (existing) {
      throw new Error('A role with this name already exists');
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  const updated = await roleDb.updateRole(roleId, updateData);

  // Audit log: Role updated
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ROLE_UPDATED',
    resource: 'role',
    resourceId: role.id,
    metadata: {
      name: updated.name,
      description: updated.description,
      previousName: role.name,
    },
  });

  return updated;
};

const deleteRole = async (organizationId, userId, roleId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  await roleDb.deleteRole(roleId);

  // Audit log: Role deleted
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ROLE_DELETED',
    resource: 'role',
    resourceId: roleId,
    metadata: {
      name: role.name,
    },
  });

  return { message: 'Role deleted successfully' };
};

const addPermissionToRole = async (organizationId, userId, roleId, permissionKey) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  const permission = await permissionDb.findPermissionByKey(permissionKey);
  if (!permission) {
    throw new Error('Permission not found');
  }

  const rolePermissions = await roleDb.findRolePermissions(roleId);
  const exists = rolePermissions.some((rp) => rp.permissionId === permission.id);
  if (exists) {
    throw new Error('Permission already assigned to this role');
  }

  const result = await roleDb.addPermissionToRole(roleId, permission.id);

  // Audit log: Permission added to role
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'PERMISSION_ASSIGNED',
    resource: 'role',
    resourceId: roleId,
    metadata: {
      roleName: role.name,
      permissionKey: permissionKey,
      permissionName: permission.name,
    },
  });

  return result;
};

const removePermissionFromRole = async (organizationId, userId, roleId, permissionId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  const rolePermissions = await roleDb.findRolePermissions(roleId);
  const exists = rolePermissions.some((rp) => rp.permissionId === permissionId);
  if (!exists) {
    throw new Error('Permission not assigned to this role');
  }

  const result = await roleDb.removePermissionFromRole(roleId, permissionId);

  // Audit log: Permission removed from role
  const permission = await permissionDb.findPermissionById(permissionId);
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'PERMISSION_REMOVED',
    resource: 'role',
    resourceId: roleId,
    metadata: {
      roleName: role.name,
      permissionKey: permission?.key || permissionId,
    },
  });

  return result;
};

const assignRoleToMember = async (organizationId, userId, memberId, roleId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can assign roles');
  }

  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  const updated = await orgDb.updateMembership(membership.id, { roleId });

  // Audit log: Role assigned to member
  const user = await orgDb.findUserById(memberId);
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ROLE_ASSIGNED',
    resource: 'membership',
    resourceId: membership.id,
    metadata: {
      memberId: memberId,
      memberEmail: user?.email,
      roleId: role.id,
      roleName: role.name,
      previousRoleId: membership.roleId,
    },
  });

  return updated;
};


export default {
  checkPermission,
  checkPermissions,
  matchPermission,
  createRole,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  assignRoleToMember,
  getAllUserPermissions,
};