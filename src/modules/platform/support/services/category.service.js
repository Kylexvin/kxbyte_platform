// src/modules/platform/support/services/category.service.js

import categoryDb from '../db/category.db.js';
import { generateSlug } from '../../../platform/organizations/utils/slug.utils.js';

const createCategory = async (data) => {
  const slug = await generateSlug(data.name);
  
  const existing = await categoryDb.findCategoryBySlug(slug);
  if (existing) {
    throw new Error('Category with this name already exists');
  }

  return categoryDb.createCategory({
    name: data.name,
    description: data.description || '',
    slug,
    isActive: true,
  });
};

const getAllCategories = async () => {
  return categoryDb.findAllCategories();
};

const getCategoryById = async (id) => {
  const category = await categoryDb.findCategoryById(id);
  if (!category) {
    throw new Error('Category not found');
  }
  return category;
};

const getCategoryBySlug = async (slug) => {
  const category = await categoryDb.findCategoryBySlug(slug);
  if (!category) {
    throw new Error('Category not found');
  }
  return category;
};

const updateCategory = async (id, data) => {
  const category = await categoryDb.findCategoryById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  if (data.name && data.name !== category.name) {
    const slug = await generateSlug(data.name);
    const existing = await categoryDb.findCategoryBySlug(slug);
    if (existing && existing.id !== id) {
      throw new Error('Category with this name already exists');
    }
    data.slug = slug;
  }

  return categoryDb.updateCategory(id, data);
};

const deleteCategory = async (id) => {
  const category = await categoryDb.findCategoryById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  // Check if category has tickets
  // TODO: Check for existing tickets

  return categoryDb.deleteCategory(id);
};

export default {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};