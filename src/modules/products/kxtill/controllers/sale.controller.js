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
    if (
      error.message === 'Shift is required' ||
      error.message === 'Shift not found' ||
      error.message === 'Shift does not match branch'
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Shift does not belong to you') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createOfflineSale = async (req, res) => {
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
    const sale = await saleService.createOfflineSale(userId, organizationId, req.body);
    res.status(201).json({ sale });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to create sales') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    if (
      error.message === 'Shift is required' ||
      error.message === 'Shift not found' ||
      error.message === 'Shift does not match branch'
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Shift does not belong to you') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create offline sale error:', error);
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
    const { limit, offset, startDate, endDate, status, branchId, search } = req.query;
    
    const sales = await saleService.getSales(organizationId, userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      startDate,
      endDate,
      status,
      branchId,
      search,
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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, saleId } = req.params;
    const result = await saleService.refundSale(organizationId, userId, saleId, req.body || {});
    res.status(200).json({
      message: 'Refund processed successfully',
      refund: result.refund,
      sale: result.sale,
      ledgerAffected: result.ledgerAffected,
      creditReversed: result.creditReversed,
      customerId: result.customerId,
    });
  } catch (error) {
    const msg = error.message || '';
    if (msg === 'You do not have access to this organization') {
      return res.status(403).json({ error: msg });
    }
    if (msg === 'Sale not found' || msg === 'Refund not found') {
      return res.status(404).json({ error: msg });
    }
    if (
      msg === 'Sale is voided and cannot be refunded' ||
      msg === 'You do not have permission to refund sales' ||
      msg === 'Branch is required to refund this sale' ||
      msg === 'You can only refund sales from your assigned branch' ||
      msg.startsWith('At least one item') ||
      msg.startsWith('Sale item') ||
      msg.startsWith('Refund quantity') ||
      msg.startsWith('Cannot refund') ||
      msg.startsWith('Refund total must') ||
      msg.startsWith('Refund amount') ||
      msg.startsWith('Allocation') ||
      msg.startsWith('Cash allocation') ||
      msg.startsWith('Credit allocation') ||
      msg.startsWith('Other allocation') ||
      msg.startsWith('Credit allocation requested')
    ) {
      return res.status(400).json({ error: msg });
    }
    if (
      msg === 'Shift is required' ||
      msg === 'Shift not found' ||
      msg === 'Shift does not match branch'
    ) {
      return res.status(400).json({ error: msg });
    }
    if (msg === 'Shift does not belong to you') {
      return res.status(403).json({ error: msg });
    }
    console.error('Refund sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSaleRefundableState = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, saleId } = req.params;
    const result = await saleService.getSaleRefundableState(organizationId, userId, saleId);
    res.status(200).json(result);
  } catch (error) {
    const msg = error.message || '';
    if (msg === 'You do not have access to this organization') {
      return res.status(403).json({ error: msg });
    }
    if (msg === 'Sale not found') {
      return res.status(404).json({ error: msg });
    }
    console.error('Get sale refundable state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createSale,
  getSales,
  getSale,
  getSaleRefundableState,
  refundSale,
  createOfflineSale,
};