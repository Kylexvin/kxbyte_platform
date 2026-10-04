// src/modules/products/kxtill/credit/controllers/credit.controller.js

import creditService from '../services/credit.service.js';

const mapError = (res, error, fallback = 'Internal server error') => {
  const msg = error.message || '';

  if (
    msg === 'Organization not found' ||
    msg === 'Branch not found' ||
    msg === 'Customer not found' ||
    msg === 'Sale not found'
  ) {
    return res.status(404).json({ error: msg });
  }

  if (
    msg === 'You do not have access to this organization' ||
    msg === 'You do not have permission to adjust credit' ||
    msg === 'You do not have permission to set credit limits'
  ) {
    return res.status(403).json({ error: msg });
  }

  if (
    msg === 'Payment amount must be a positive number' ||
    msg === 'Adjustment amount must be a positive number' ||
    msg === 'Adjustment note is required' ||
    msg === "Adjustment direction must be 'INCREASE' or 'DECREASE'" ||
    msg === 'Credit limit must be a non-negative number or null' ||
    msg === 'Customer has no outstanding balance' ||
    msg.startsWith('Payment exceeds outstanding balance')
  ) {
    return res.status(400).json({ error: msg });
  }

  console.error('Credit controller error:', error);
  return res.status(500).json({ error: fallback });
};

// ============================================================
// GET BALANCE + CONFIG
// ============================================================

const getBalance = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, customerId } = req.params;
    const result = await creditService.getBalance(organizationId, userId, customerId);
    res.status(200).json(result);
  } catch (error) {
    return mapError(res, error, 'Failed to fetch credit balance');
  }
};

// ============================================================
// LIST LEDGER
// ============================================================

const getLedger = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, customerId } = req.params;
    const { limit, offset, type, startDate, endDate } = req.query;

    const result = await creditService.getLedger(organizationId, userId, customerId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      type,
      startDate,
      endDate,
    });

    res.status(200).json(result);
  } catch (error) {
    return mapError(res, error, 'Failed to fetch credit ledger');
  }
};

// ============================================================
// RECORD PAYMENT
// ============================================================

const recordPayment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, customerId } = req.params;
    const result = await creditService.recordPayment(organizationId, userId, customerId, req.body);
    res.status(201).json(result);
  } catch (error) {
    return mapError(res, error, 'Failed to record credit payment');
  }
};

// ============================================================
// RECORD ADJUSTMENT
// ============================================================

const recordAdjustment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, customerId } = req.params;
    const result = await creditService.recordAdjustment(organizationId, userId, customerId, req.body);
    res.status(201).json(result);
  } catch (error) {
    return mapError(res, error, 'Failed to record credit adjustment');
  }
};

// ============================================================
// SET CREDIT LIMIT
// ============================================================

const setCreditLimit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, customerId } = req.params;
    const { creditLimit } = req.body;

    const customer = await creditService.setCreditLimit(
      organizationId,
      userId,
      customerId,
      creditLimit
    );

    res.status(200).json({ customer });
  } catch (error) {
    return mapError(res, error, 'Failed to set credit limit');
  }
};

export default {
  getBalance,
  getLedger,
  recordPayment,
  recordAdjustment,
  setCreditLimit,
};