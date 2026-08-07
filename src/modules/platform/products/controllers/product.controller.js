// src/modules/platform/products/controllers/product.controller.js

import productService from '../services/product.service.js';
import productValidator from '../validators/product.validator.js';

const listAllProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const products = await productService.listAllProducts();
    res.status(200).json({ products });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrganizationProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const products = await productService.getOrganizationProducts(organizationId, userId);
    res.status(200).json({ products });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get organization products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const activateProduct = async (req, res) => {
  const validation = productValidator.validateActivateProduct(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { productKey } = req.body;

    const result = await productService.activateProduct(organizationId, userId, productKey);
    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can activate products') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product is already activated for this organization') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Activate product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deactivateProduct = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    const result = await productService.deactivateProduct(organizationId, userId, productKey);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can deactivate products') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product is not activated for this organization') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Deactivate product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductActivationStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, productKey } = req.params;

    const result = await productService.getProductActivationStatus(organizationId, userId, productKey);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get product activation status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  listAllProducts,
  getOrganizationProducts,
  activateProduct,
  deactivateProduct,
  getProductActivationStatus,
};