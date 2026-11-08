// src/modules/products/admin/crm/controllers/activities.controller.js

import activitiesService from '../../../kxcrm/services/activities.service.js';

// ============================================================
// ERROR MAP
// ============================================================

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
// LIST (paginated)
// ============================================================

export const listForLead = async (req, res) => {
  try {
    const { type, from, to, page, limit } = req.query;

    const filters = {
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;

    const result = await activitiesService.listForLead(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      filters,
      { limit: limitNum, offset: (pageNum - 1) * limitNum }
    );

    res.json({
      data: result.activities,
      meta: { total: result.total, page: pageNum, limit: limitNum },
    });
  } catch (err) {
    handleError(res, err, 'admin crm activities listForLead');
  }
};

// ============================================================
// COUNT
// ============================================================

export const count = async (req, res) => {
  try {
    const result = await activitiesService.countForLead(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm activities count');
  }
};

// ============================================================
// LOG
// ============================================================

export const log = async (req, res) => {
  try {
    const activity = await activitiesService.logActivity(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      req.body
    );
    res.status(201).json({ data: activity });
  } catch (err) {
    handleError(res, err, 'admin crm activities log');
  }
};

// ============================================================
// DELETE (NOTE only)
// ============================================================

export const remove = async (req, res) => {
  try {
    const result = await activitiesService.deleteActivity(
      req.user.userId,
      req.internalOrgId,
      req.params.activityId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm activities remove');
  }
};