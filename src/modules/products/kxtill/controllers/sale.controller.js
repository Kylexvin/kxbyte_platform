// src/modules/products/kxtill/controllers/sale.controller.js

import saleService from '../services/sale.service.js';
import saleValidator from '../validators/sale.validator.js';

const createSale = async (req, res) => {
  const validation = saleValidator.validateCreateSale(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const sale = await saleService.createSale(userId, organizationId, req.body);
    res.status(201).json({ sale });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to create sales') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSales = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { limit, offset, startDate, endDate, status } = req.query;
    const sales = await saleService.getSales(organizationId, userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      startDate,
      endDate,
      status,
    });
    res.status(200).json(sales);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSale = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, saleId } = req.params;
    const sale = await saleService.getSale(organizationId, userId, saleId);
    res.status(200).json({ sale });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Sale not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const refundSale = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, saleId } = req.params;
    const sale = await saleService.refundSale(organizationId, userId, saleId);
    res.status(200).json({ message: 'Sale refunded successfully', sale });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Sale not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Sale already refunded') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to refund sales') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Refund sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createSale,
  getSales,
  getSale,
  refundSale,
};