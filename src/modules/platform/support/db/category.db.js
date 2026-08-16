// src/modules/platform/support/db/category.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createCategory = async (data) => {
  return prisma.supportCategory.create({ data });
};

const findCategoryById = async (id) => {
  return prisma.supportCategory.findUnique({ where: { id } });
};

const findCategoryBySlug = async (slug) => {
  return prisma.supportCategory.findUnique({ where: { slug } });
};

const findAllCategories = async () => {
  return prisma.supportCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
};

const updateCategory = async (id, data) => {
  return prisma.supportCategory.update({ where: { id }, data });
};

const deleteCategory = async (id) => {
  return prisma.supportCategory.update({
    where: { id },
    data: { isActive: false },
  });
};

export default {
  createCategory,
  findCategoryById,
  findCategoryBySlug,
  findAllCategories,
  updateCategory,
  deleteCategory,
};