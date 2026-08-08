// src/modules/platform/products/db/product.db.js

import prisma from '../../../../database/postgres/prisma.js';

const findAllProducts = async () => {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
};

const findProductByKey = async (key) => {
  return prisma.product.findUnique({
    where: { key },
  });
};

const findProductById = async (id) => {
  return prisma.product.findUnique({
    where: { id },
  });
};

const findOrganizationProduct = async (organizationId, productId) => {
  return prisma.organizationProduct.findUnique({
    where: {
      organizationId_productId: {
        organizationId,
        productId,
      },
    },
    include: {
      product: true,
    },
  });
};

const findOrganizationProducts = async (organizationId) => {
  return prisma.organizationProduct.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      product: true,
    },
  });
};

const createOrganizationProduct = async (data) => {
  return prisma.organizationProduct.create({ data });
};

const deactivateOrganizationProduct = async (organizationId, productId) => {
  return prisma.organizationProduct.update({
    where: {
      organizationId_productId: {
        organizationId,
        productId,
      },
    },
    data: { isActive: false },
  });
};


const updateOrganizationProduct = async (organizationId, productId, data) => {
  return prisma.organizationProduct.update({
    where: {
      organizationId_productId: {
        organizationId,
        productId,
      },
    },
    data,
  });
};

const isProductActivated = async (organizationId, productKey) => {
  const product = await findProductByKey(productKey);
  if (!product) return false;

  const orgProduct = await findOrganizationProduct(organizationId, product.id);
  return !!orgProduct && orgProduct.isActive;
};

export default {
  findAllProducts,
  findProductByKey,
  findProductById,
  findOrganizationProduct,
  findOrganizationProducts,
  createOrganizationProduct,
  deactivateOrganizationProduct,
  updateOrganizationProduct, 
  isProductActivated,
};