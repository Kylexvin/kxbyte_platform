// src/modules/products/kxtill/controllers/billing.controller.js

import billingService from '../services/billing.service.js';

export const get = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.userId;
    const data = await billingService.getBilling(organizationId, userId);
    res.json({ data });
  } catch (err) {
    const code = err.message.includes('access') ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
};

export const payments = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.userId;
    const data = await billingService.getPayments(organizationId, userId);
    res.json({ data });
  } catch (err) {
    const code = err.message.includes('access') ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
};

export default { get, payments };