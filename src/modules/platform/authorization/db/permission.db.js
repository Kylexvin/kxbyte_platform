// src/modules/platform/authorization/db/permission.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createPermission = async (data) => {
  return prisma.permission.upsert({
    where: { key: data.key },
    update: {
      name: data.name,
      description: data.description,
      productKey: data.productKey,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    create: data,
  });
};

const createManyPermissions = async (permissions) => {
  const results = [];
  for (const permission of permissions) {
    const result = await createPermission(permission);
    results.push(result);
  }
  return results;
};

const findPermissionByKey = async (key) => {
  return prisma.permission.findUnique({
    where: { key },
  });
};

const findPermissionsByProduct = async (productKey) => {
  return prisma.permission.findMany({
    where: {
      productKey,
      isActive: true,
    },
    orderBy: [
      { key: 'asc' },
    ],
  });
};

// Public list — excludes internal admin product
const findAllPermissions = async () => {
  return prisma.permission.findMany({
    where: {
      isActive: true,
      productKey: { not: 'admin' },
    },
    orderBy: [
      { productKey: 'asc' },
      { key: 'asc' },
    ],
  });
};

// Internal use only — includes admin product
const findAllPermissionsIncludingInternal = async () => {
  return prisma.permission.findMany({
    where: { isActive: true },
    orderBy: [
      { productKey: 'asc' },
      { key: 'asc' },
    ],
  });
};

const findPermissionsByKeys = async (keys) => {
  return prisma.permission.findMany({
    where: {
      key: { in: keys },
      isActive: true,
    },
  });
};

const deletePermission = async (key) => {
  return prisma.permission.delete({
    where: { key },
  });
};

const findPermissionById = async (id) => {
  return prisma.permission.findUnique({
    where: { id },
  });
};

const findPermissionsByUser = async (userId, organizationId) => {
  // Get user's role
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!membership || !membership.role) {
    return [];
  }

  // Check if user has '*' wildcard
  const hasWildcard = membership.role.permissions.some(
    (rp) => rp.permission.key === '*'
  );

  if (hasWildcard) {
    // Return all permissions for the product — excluding internal
    const allPermissions = await prisma.permission.findMany({
      where: {
        productKey: 'kxtill',
        isActive: true,
        NOT: { productKey: 'admin' },
      },
    });
    return allPermissions;
  }

  return membership.role.permissions.map((rp) => rp.permission);
};

export default {
  createPermission,
  createManyPermissions,
  findPermissionByKey,
  findPermissionsByProduct,
  findAllPermissions,
  findAllPermissionsIncludingInternal,
  findPermissionsByKeys,
  deletePermission,
  findPermissionById,
  findPermissionsByUser,
};