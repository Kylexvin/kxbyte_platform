// src/modules/platform/authorization/db/role.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createRole = async (data) => {
  return prisma.role.create({ data });
};

const findRoleById = async (id) => {
  return prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });
};

const findRoleByOrgAndName = async (organizationId, name) => {
  return prisma.role.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name,
      },
    },
  });
};

const findRolesByOrganization = async (organizationId) => {
  return prisma.role.findMany({
    where: { organizationId },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
};

const updateRole = async (id, data) => {
  return prisma.role.update({
    where: { id },
    data,
  });
};

const deleteRole = async (id) => {
  return prisma.role.delete({
    where: { id },
  });
};

const addPermissionToRole = async (roleId, permissionId) => {
  return prisma.rolePermission.create({
    data: {
      roleId,
      permissionId,
    },
  });
};

const removePermissionFromRole = async (roleId, permissionId) => {
  return prisma.rolePermission.delete({
    where: {
      roleId_permissionId: {
        roleId,
        permissionId,
      },
    },
  });
};

const findRolePermissions = async (roleId) => {
  const role = await findRoleById(roleId);
  return role?.permissions || [];
};

export default {
  createRole,
  findRoleById,
  findRoleByOrgAndName,
  findRolesByOrganization,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  findRolePermissions,
};