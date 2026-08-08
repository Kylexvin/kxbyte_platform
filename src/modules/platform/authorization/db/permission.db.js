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

const findAllPermissions = async () => {
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

export default {
  createPermission,
  createManyPermissions,
  findPermissionByKey,
  findPermissionsByProduct,
  findAllPermissions,
  findPermissionsByKeys,
  deletePermission,
  findPermissionById,
};