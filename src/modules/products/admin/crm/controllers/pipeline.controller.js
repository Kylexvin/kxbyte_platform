// src/modules/products/admin/crm/controllers/pipeline.controller.js

import pipelineService from '../../../kxcrm/services/pipeline.service.js';

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
// HANDLERS
// ============================================================

export const list = async (req, res) => {
  try {
    const stages = await pipelineService.listStages(
      req.user.userId,
      req.internalOrgId,
      { includeInactive: req.query.includeInactive === 'true' }
    );
    res.json({ data: stages });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline list');
  }
};

export const getOne = async (req, res) => {
  try {
    const stage = await pipelineService.getStage(
      req.user.userId,
      req.internalOrgId,
      req.params.stageId
    );
    res.json({ data: stage });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline getOne');
  }
};

export const getStatus = async (req, res) => {
  try {
    const status = await pipelineService.getStatus(
      req.user.userId,
      req.internalOrgId
    );
    res.json({ data: status });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline getStatus');
  }
};

export const create = async (req, res) => {
  try {
    const stage = await pipelineService.createStage(
      req.user.userId,
      req.internalOrgId,
      req.body
    );
    res.status(201).json({ data: stage });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline create');
  }
};

export const update = async (req, res) => {
  try {
    const stage = await pipelineService.updateStage(
      req.user.userId,
      req.internalOrgId,
      req.params.stageId,
      req.body
    );
    res.json({ data: stage });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline update');
  }
};

export const reorder = async (req, res) => {
  try {
    const stages = await pipelineService.reorderStages(
      req.user.userId,
      req.internalOrgId,
      req.body.updates
    );
    res.json({ data: stages });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline reorder');
  }
};

export const remove = async (req, res) => {
  try {
    const result = await pipelineService.deleteStage(
      req.user.userId,
      req.internalOrgId,
      req.params.stageId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin crm pipeline delete');
  }
};