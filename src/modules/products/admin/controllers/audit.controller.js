// src/modules/products/admin/controllers/audit.controller.js

import audit from '../../../platform/audit/index.js';

export const listForOrg = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { action, resource, userId, from, to, limit, offset } = req.query;

    const result = await audit.getAuditEvents(organizationId, {
      action,
      resource,
      userId,
      from,
      to,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    res.json(result);
  } catch (err) {
    console.error('admin org audit error:', err);
    res.status(500).json({ error: err.message });
  }
};