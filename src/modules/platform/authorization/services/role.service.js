// src/modules/platform/authorization/services/role.service.js

import roleDb from '../db/role.db.js';
import permissionDb from '../db/permission.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';

const createRole = async (organizationId, userId, data) => {
  const { name, description, permissionKeys } = data;

  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage roles');
  }

  // Check if role already exists
  const existing = await roleDb.findRoleByOrgAndName(organizationId, name);
  if (existing) {
    throw new Error('A role with this name already exists');
  }

  // Create role
  const role = await roleDb.createRole({
    organizationId,
    name,
    description: description || '',
  });

  // ✅ Assign permissions if provided
  if (permissionKeys && Array.isArray(permissionKeys) && permissionKeys.length > 0) {
    for (const key of permissionKeys) {
      const permission = await permissionDb.findPermissionByKey(key);
      if (permission) {
        await roleDb.addPermissionToRole(role.id, permission.id);
      }
    }
  }

  // Audit log
  await audit.log({
    organizationId,
    userId,
    action: 'ROLE_CREATED',
    resource: 'role',
    resourceId: role.id,
    metadata: {
      name: role.name,
      permissionCount: permissionKeys?.length || 0,
    },
  });

  // Return role with permissions
  return roleDb.findRoleById(role.id);
};

const getRoles = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return roleDb.findRolesByOrganization(organizationId);
};

const getRole = async (organizationId, userId, roleId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  return role;
};

// src/modules/platform/authorization/services/role.service.js

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

  // Check duplicate name
  if (data.name && data.name !== role.name) {
    const existing = await roleDb.findRoleByOrgAndName(organizationId, data.name);
    if (existing) {
      throw new Error('A role with this name already exists');
    }
  }

  // Update role name/description
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  const updated = await roleDb.updateRole(roleId, updateData);

  // ✅ Sync permissions if provided
  if (data.permissionKeys && Array.isArray(data.permissionKeys)) {
    // Get current permissions
    const currentPerms = await roleDb.findRolePermissions(roleId);
    const currentKeys = currentPerms.map((rp) => rp.permission.key);

    // Find permissions to add and remove
    const toAdd = data.permissionKeys.filter((key) => !currentKeys.includes(key));
    const toRemove = currentKeys.filter((key) => !data.permissionKeys.includes(key));

    // Add new permissions
    for (const key of toAdd) {
      const permission = await permissionDb.findPermissionByKey(key);
      if (permission) {
        await roleDb.addPermissionToRole(roleId, permission.id);
      }
    }

    // Remove old permissions
    for (const key of toRemove) {
      const permission = await permissionDb.findPermissionByKey(key);
      if (permission) {
        await roleDb.removePermissionFromRole(roleId, permission.id);
      }
    }
  }

  // Audit log
  await audit.log({
    organizationId,
    userId,
    action: 'ROLE_UPDATED',
    resource: 'role',
    resourceId: roleId,
    metadata: {
      name: updated.name,
      previousName: role.name,
      permissionsUpdated: data.permissionKeys !== undefined,
    },
  });

  // Return updated role with permissions
  return roleDb.findRoleById(roleId);
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

  // Check if role is assigned to any members
  // TODO: Check if any members have this role

  return roleDb.deleteRole(roleId);
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

  // Check if already assigned
  const rolePermissions = await roleDb.findRolePermissions(roleId);
  const exists = rolePermissions.some((rp) => rp.permissionId === permission.id);
  if (exists) {
    throw new Error('Permission already assigned to this role');
  }

  return roleDb.addPermissionToRole(roleId, permission.id);
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

  // Check if permission exists in role
  const rolePermissions = await roleDb.findRolePermissions(roleId);
  const exists = rolePermissions.some((rp) => rp.permissionId === permissionId);
  if (!exists) {
    throw new Error('Permission not assigned to this role');
  }

  return roleDb.removePermissionFromRole(roleId, permissionId);
};

const assignRoleToMember = async (organizationId, userId, memberId, roleId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can assign roles');
  }

  // Check if member exists
  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  // Check if role exists
  const role = await roleDb.findRoleById(roleId);
  if (!role) {
    throw new Error('Role not found');
  }

  if (role.organizationId !== organizationId) {
    throw new Error('Role does not belong to this organization');
  }

  // Update membership
  return orgDb.updateMembership(membership.id, { roleId });
};

export default {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  assignRoleToMember,
};