// src/modules/products/admin/controllers/billing.controller.js

import billingService from '../services/billing.service.js';

const STATUS_BY_TYPE = {
  ValidationError: 400,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
};

const handleError = (res, err, label) => {
  const status = STATUS_BY_TYPE[err.name] || 500;
  if (status >= 500) console.error(`${label} error:`, err);
  res.status(status).json({ error: err.message, code: err.code });
};

// ============================================================
// CONFIG
// ============================================================

export const getConfig = async (req, res) => {
  try {
    const config = await billingService.getConfig();
    res.json({ data: config });
  } catch (err) {
    handleError(res, err, 'admin billing getConfig');
  }
};

export const updateConfig = async (req, res) => {
  try {
    const config = await billingService.updateConfig(req.user.userId, req.body);
    res.json({ data: config });
  } catch (err) {
    handleError(res, err, 'admin billing updateConfig');
  }
};

// ============================================================
// SUMMARY
// ============================================================

export const getSummary = async (req, res) => {
  try {
    const summary = await billingService.getSummary();
    res.json({ data: summary });
  } catch (err) {
    handleError(res, err, 'admin billing getSummary');
  }
};

// ============================================================
// PAYMENTS
// ============================================================

export const listPayments = async (req, res) => {
  try {
    const { productKey, status, search, organizationId, from, to, page, limit } = req.query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;

    const result = await billingService.listPayments(
      { productKey, status, search, organizationId, from, to },
      { limit: limitNum, offset: (pageNum - 1) * limitNum }
    );

    res.json({
      data: result.payments,
      meta: { total: result.total, page: pageNum, limit: limitNum },
    });
  } catch (err) {
    handleError(res, err, 'admin billing listPayments');
  }
};

export const recordPayment = async (req, res) => {
  try {
    const payment = await billingService.recordPayment(req.user.userId, req.body);
    res.status(201).json({ data: payment });
  } catch (err) {
    handleError(res, err, 'admin billing recordPayment');
  }
};

export const findSubscription = async (req, res) => {
  try {
    const { organizationId, productKey } = req.query;
    if (!organizationId || !productKey) {
      return res.status(400).json({ error: 'organizationId and productKey required' });
    }
    const sub = await billingService.findSubscriptionForPayment(organizationId, productKey);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ data: sub });
  } catch (err) {
    handleError(res, err, 'admin billing findSubscription');
  }
};

export const listSubscriptions = async (req, res) => {
  try {
    const { search } = req.query;
    const data = await billingService.listSubscriptionsForPicker(search);
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin billing listSubscriptions');
  }
};