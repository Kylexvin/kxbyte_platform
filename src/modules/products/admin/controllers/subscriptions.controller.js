// src/modules/products/admin/controllers/subscriptions.controller.js
import subscriptionService from '../../../platform/subscriptions/services/subscription.service.js';

export const list = async (req, res) => {
  try {
    const { productKey, status } = req.query;
    const subs = await subscriptionService.adminListAll({ productKey, status });
    res.json({ data: subs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const sub = await subscriptionService.getSubscription(organizationId, productKey);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const payments = await subscriptionService.getPaymentHistory(organizationId, productKey);
    res.json({ data: { ...sub, payments } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const setStatus = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const result = await subscriptionService.adminSetStatus(
      organizationId, productKey, req.platformAdmin.userId, req.body
    );
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const setDates = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const result = await subscriptionService.adminSetDates(
      organizationId, productKey, req.platformAdmin.userId, req.body
    );
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const renew = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const result = await subscriptionService.adminRenew(
      organizationId, productKey, req.platformAdmin.userId, req.body
    );
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const suspend = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const result = await subscriptionService.adminSuspend(
      organizationId, productKey, req.platformAdmin.userId, req.body.reason
    );
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const extendTrial = async (req, res) => {
  try {
    const { organizationId, productKey } = req.params;
    const { days } = req.body;
    const result = await subscriptionService.adminExtendTrial(
      organizationId, productKey, req.platformAdmin.userId, days
    );
    res.json({ data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};