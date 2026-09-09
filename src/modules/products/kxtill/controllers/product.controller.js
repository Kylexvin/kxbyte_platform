// src/modules/products/kxtill/controllers/product.controller.js

import productService from '../services/product.service.js';
import productValidator from '../validators/product.validator.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import productDb from '../db/product.db.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

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

const updateProductUnit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productId, unitId } = req.params;
    const { barcode, price, allowFractional, conversionQty } = req.body;

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'kxtill.inventory.update'
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to update products' });
    }

    const unit = await productDb.updateProductUnit(unitId, {
      barcode,
      price,
      allowFractional,
      conversionQty,
    });

    res.status(200).json({ unit });
  } catch (error) {
    if (error.message === 'Unit not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update product unit error:', error);
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

const updateBranchProduct = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId, productId } = req.params;
    const { displayName, description, price, isAvailable } = req.body;

    // Just call the service — it handles permissions
    const result = await productService.updateBranchProduct(
      organizationId,
      userId,
      branchId,
      productId,
      { displayName, description, price, isAvailable }
    );

    res.status(200).json({ branchProduct: result });
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have permission to update products') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Branch product not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update branch product error:', error);
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

const bulkCreateProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      try {
        if (!productData.name) {
          errors.push({ index: i, error: 'Product name is required', data: productData });
          continue;
        }
        if (!productData.baseUnit) {
          errors.push({ index: i, error: 'Base unit is required', data: productData });
          continue;
        }

        const product = await productService.createProduct(userId, organizationId, productData);
        results.push(product);
      } catch (error) {
        errors.push({ index: i, error: error.message, data: productData });
      }
    }

    res.status(201).json({
      message: `Created ${results.length} products, ${errors.length} failed`,
      results,
      errors,
    });
  } catch (error) {
    console.error('Bulk create products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductByBarcode = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, barcode } = req.params;
    const { branchId } = req.query;

    const product = await productService.getProductByBarcode(
      organizationId,
      userId,
      barcode,
      branchId
    );

    res.status(200).json({ product });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get product by barcode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const searchProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { q, branchId, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    if (!branchId) {
      return res.status(400).json({ error: 'Branch ID is required' });
    }

    const products = await productService.searchProducts(
      organizationId,
      userId,
      q,
      branchId,
      parseInt(limit)
    );

    res.status(200).json({ items: products });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Search products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductsForSync = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { since, limit = 50, offset = 0, branchId } = req.query; // <-- ADD branchId

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const result = await productService.getProductsForSync(
      organizationId,
      since,
      parseInt(limit),
      parseInt(offset),
      branchId // <-- PASS branchId
    );

    res.status(200).json({
      items: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      version: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranchProductsForSync = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId, since, limit = 50, offset = 0 } = req.query;

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const result = await productService.getBranchProductsForSync(
      organizationId,
      branchId,
      since,
      parseInt(limit),
      parseInt(offset)
    );

    // Return consistent shape with branch products endpoint
    res.status(200).json({
      items: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      version: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync branch products error:', error);
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
  bulkCreateProducts,
  getProductByBarcode,
  searchProducts,
  updateProductUnit,
  getProductsForSync,
  getBranchProductsForSync,
  updateBranchProduct,

};