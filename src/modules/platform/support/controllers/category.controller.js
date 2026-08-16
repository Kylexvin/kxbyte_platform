// src/modules/platform/support/controllers/category.controller.js

import categoryService from '../services/category.service.js';

const createCategory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only owner or admin can create categories
    // For now, only allow if user has admin permission
    const permissions = req.user?.permissions || [];
    if (!permissions.includes('*') && !permissions.includes('admin.help.manage')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const category = await categoryService.createCategory(req.body);
    res.status(201).json({ category });
  } catch (error) {
    if (error.message === 'Category with this name already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const categories = await categoryService.getAllCategories();
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);
    res.status(200).json({ category });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = req.user?.permissions || [];
    if (!permissions.includes('*') && !permissions.includes('admin.help.manage')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    const category = await categoryService.updateCategory(id, req.body);
    res.status(200).json({ category });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Category with this name already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = req.user?.permissions || [];
    if (!permissions.includes('*') && !permissions.includes('admin.help.manage')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id } = req.params;
    await categoryService.deleteCategory(id);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
};