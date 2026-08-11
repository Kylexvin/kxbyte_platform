// src/modules/products/kxtill/controllers/product.controller.js

import productService from '../services/product.service.js';
import productValidator from '../validators/product.validator.js';

const createProduct = async (req, res) => {
  const validation = productValidator.validateCreateProduct(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const product = await productService.createProduct(userId, organizationId, req.body);
    res.status(201).json({ product });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to create products') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { limit, offset, search, category } = req.query;
    const products = await productService.getProducts(organizationId, userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      search,
      category,
    });
    res.status(200).json(products);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProduct = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productId } = req.params;
    const product = await productService.getProduct(organizationId, userId, productId);
    res.status(200).json({ product });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  const validation = productValidator.validateUpdateProduct(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productId } = req.params;
    const product = await productService.updateProduct(organizationId, userId, productId, req.body);
    res.status(200).json({ product });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to update products') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productId } = req.params;
    const product = await productService.deleteProduct(organizationId, userId, productId);
    res.status(200).json({ message: 'Product deleted successfully', product });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to delete products') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const products = await productService.getLowStockProducts(organizationId, userId);
    res.status(200).json({ products });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get low stock products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// BRANCH PRODUCT CONTROLLERS
// ============================================================

const getBranchProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const { limit, offset, search, category } = req.query;

    const result = await productService.getBranchProducts(
      organizationId,
      userId,
      branchId,
      {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
        search,
        category,
      }
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this branch') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branch products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateBranchProductStock = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId, productId } = req.params;
    const { stock, minStock } = req.body;

    if (stock === undefined) {
      return res.status(400).json({ error: 'Stock is required' });
    }

    const result = await productService.updateBranchProductStock(
      organizationId,
      userId,
      branchId,
      productId,
      { stock, minStock }
    );

    res.status(200).json({ message: 'Stock updated successfully', result });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this branch') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Branch product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to update inventory') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update branch product stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getBranchProducts,
  updateBranchProductStock,
};