// src/modules/products/admin/crm/controllers/leads.controller.js

import leadsService from '../../../kxcrm/services/leads.service.js';
import activitiesService from '../../../kxcrm/services/activities.service.js';
import conversionService from '../services/conversion.service.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';

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
// LIST
// ============================================================

export const list = async (req, res) => {
  try {
    const {
      stageId, assigneeId, search, source,
      hasConverted, hasLost,
      sortBy, sortOrder,
      page, limit,
    } = req.query;

    const filters = {
      stageId,
      assigneeId,
      search,
      source,
      hasConverted: hasConverted === undefined ? undefined : hasConverted === 'true',
      hasLost: hasLost === undefined ? undefined : hasLost === 'true',
    };

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;

    const result = await leadsService.listLeads(
      req.user.userId,
      req.internalOrgId,
      filters,
      {
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        sortBy,
        sortOrder,
      }
    );

    res.json({
      data: result.leads,
      meta: { total: result.total, page: pageNum, limit: limitNum },
    });
  } catch (err) {
    handleError(res, err, 'admin crm leads list');
  }
};

// ============================================================
// DETAIL
// ============================================================

export const getOne = async (req, res) => {
  try {
    const lead = await leadsService.getLead(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId
    );
    res.json({ data: lead });
  } catch (err) {
    handleError(res, err, 'admin crm leads getOne');
  }
};

// ============================================================
// CREATE
// ============================================================

export const create = async (req, res) => {
  try {
    const lead = await leadsService.createLead(
      req.user.userId,
      req.internalOrgId,
      req.body
    );
    res.status(201).json({ data: lead });
  } catch (err) {
    handleError(res, err, 'admin crm leads create');
  }
};

// ============================================================
// UPDATE (non-stage, non-assignment fields)
// ============================================================

export const update = async (req, res) => {
  try {
    const lead = await leadsService.updateLead(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      req.body
    );
    res.json({ data: lead });
  } catch (err) {
    handleError(res, err, 'admin crm leads update');
  }
};

// ============================================================
// MOVE STAGE (non-terminal only)
// ============================================================

export const moveStage = async (req, res) => {
  try {
    const { stageId, lostReason } = req.body;
    if (!stageId) {
      return res.status(400).json({ error: 'stageId is required', code: 'STAGE_ID_REQUIRED' });
    }
    const lead = await leadsService.moveLeadToStage(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      stageId,
      { lostReason }
    );
    res.json({ data: lead });
  } catch (err) {
    handleError(res, err, 'admin crm leads moveStage');
  }
};

// ============================================================
// PROMOTE TO WON (distinct action — requires admin.leads.convert)
// ============================================================

export const promoteToWon = async (req, res) => {
  try {
    const allowed = await authorizationService.checkPermission(
      req.user.userId,
      req.internalOrgId,
      'admin.leads.convert'
    );
    if (!allowed) {
      return res.status(403).json({
        error: 'You do not have permission to move leads into the Won stage',
        code: 'REQUIRES_CONVERT_PERMISSION',
      });
    }

    const lead = await leadsService.promoteLeadToWon(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId
    );
    res.json({ data: lead });
  } catch (err) {
    handleError(res, err, 'admin crm leads promoteToWon');
  }
};

// ============================================================
// ASSIGNEES — list / add / remove
// ============================================================

export const listAssignees = async (req, res) => {
  try {
    const assignees = await leadsService.listAssignees(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId
    );
    res.json({ data: assignees });
  } catch (err) {
    handleError(res, err, 'admin crm leads listAssignees');
  }
};

export const addAssignee = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required', code: 'USER_ID_REQUIRED' });
    }
    const row = await leadsService.addAssignee(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      userId
    );
    res.status(201).json({ data: row });
  } catch (err) {
    handleError(res, err, 'admin crm leads addAssignee');
  }
};

export const removeAssignee = async (req, res) => {
  try {
    const result = await leadsService.removeAssignee(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      req.params.userId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm leads removeAssignee');
  }
};

// ============================================================
// CONVERT (link to existing org — body: { organizationId })
// ============================================================

export const convert = async (req, res) => {
  try {
    const { organizationId } = req.body || {};
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required', code: 'ORG_ID_REQUIRED' });
    }

    const result = await conversionService.convertLeadToOrganization(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      { organizationId }
    );

    res.status(result.alreadyConverted ? 200 : 201).json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm leads convert');
  }
};

// ============================================================
// DELETE (soft)
// ============================================================

export const remove = async (req, res) => {
  try {
    const result = await leadsService.deleteLead(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm leads delete');
  }
};

// ============================================================
// LOG ACTIVITY (gated — Won/Lost leads are read-only)
// ============================================================

export const logActivity = async (req, res) => {
  try {
    // Engine check: refuse if lead is Won or Lost.
    await leadsService.assertCanLogActivity(req.internalOrgId, req.params.leadId);

    const activity = await activitiesService.logActivity(
      req.user.userId,
      req.internalOrgId,
      req.params.leadId,
      req.body
    );
    res.status(201).json({ data: activity });
  } catch (err) {
    handleError(res, err, 'admin crm leads logActivity');
  }
};