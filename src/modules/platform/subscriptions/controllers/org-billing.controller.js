// src/modules/platform/subscriptions/controllers/org-billing.controller.js

import orgBillingService from '../services/org-billing.service.js';

const getBilling = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const data = await orgBillingService.getBilling(organizationId, userId);
    res.json({ data });
  } catch (error) {
    console.error('Org billing fetch error:', error);
    const code = error.message.includes('access') ? 403 : 500;
    res.status(code).json({ error: error.message });
  }
};

const notifyPayment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const result = await orgBillingService.notifyPayment(
      organizationId,
      userId,
      req.body || {}
    );
    res.status(201).json(result);
  } catch (error) {
    console.error('Notify payment error:', error);
    const code = error.message.includes('access')
      ? 403
      : error.message.includes('not found')
      ? 404
      : 400;
    res.status(code).json({ error: error.message });
  }
};

export default { getBilling, notifyPayment };