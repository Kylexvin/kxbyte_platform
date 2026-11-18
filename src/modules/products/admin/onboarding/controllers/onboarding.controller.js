// src/modules/products/admin/onboarding/controllers/onboarding.controller.js

import onboardingService from '../services/onboarding.service.js';

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

const boolOrUndef = (v) =>
  v === undefined ? undefined : v === 'true' ? true : v === 'false' ? false : undefined;

// LIST
export const list = async (req, res) => {
  try {
    const { productKey, ownerId, status, page, limit } = req.query;
    const result = await onboardingService.listOnboardings({
      productKey,
      ownerId,
      status,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    res.json({
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    handleError(res, err, 'admin onboarding list');
  }
};

// DETAIL
export const getOne = async (req, res) => {
  try {
    const data = await onboardingService.getOnboarding(req.params.onboardingId);
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding getOne');
  }
};

// OWNER
export const assignOwner = async (req, res) => {
  try {
    const { ownerId } = req.body || {};
    const data = await onboardingService.assignOwner(
      req.params.onboardingId,
      ownerId || null,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding assignOwner');
  }
};

// TASK MUTATIONS
export const completeTask = async (req, res) => {
  try {
    const data = await onboardingService.markComplete(
      req.params.onboardingId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding completeTask');
  }
};

export const ignoreTask = async (req, res) => {
  try {
    const data = await onboardingService.markIgnored(
      req.params.onboardingId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding ignoreTask');
  }
};

export const reopenTask = async (req, res) => {
  try {
    const data = await onboardingService.reopen(
      req.params.onboardingId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding reopenTask');
  }
};

export const setDueDate = async (req, res) => {
  try {
    const { dueAt } = req.body || {};
    const data = await onboardingService.setDueDate(
      req.params.onboardingId,
      req.params.taskId,
      dueAt || null,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding setDueDate');
  }
};

export const setTaskNotes = async (req, res) => {
  try {
    const { notes } = req.body || {};
    const data = await onboardingService.setTaskNotes(
      req.params.onboardingId,
      req.params.taskId,
      notes
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding setTaskNotes');
  }
};

// AD-HOC TASKS
export const addAdHoc = async (req, res) => {
  try {
    const data = await onboardingService.addAdHocTask(
      req.params.orgId,
      req.user.userId,
      req.body || {}
    );
    res.status(201).json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding addAdHoc');
  }
};

export const deleteAdHoc = async (req, res) => {
  try {
    const data = await onboardingService.deleteAdHocTask(
      req.params.orgId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding deleteAdHoc');
  }
};

export const listOrgs = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await onboardingService.listOrgsWithOnboarding({
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 25,
    });
    res.json({
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    handleError(res, err, 'admin onboarding listOrgs');
  }
};

export const start = async (req, res) => {
  try {
    const { organizationId, productKey } = req.body || {};
    if (!organizationId || !productKey) {
      return res.status(400).json({ error: 'organizationId and productKey required' });
    }
    const seeded = await onboardingService.startOnboarding(
      organizationId,
      productKey,
      req.user.userId
    );
    res.status(201).json({ data: seeded });
  } catch (err) {
    handleError(res, err, 'admin onboarding start');
  }
};

export const assignAdHoc = async (req, res) => {
  try {
    const { assigneeId } = req.body || {};
    const data = await onboardingService.assignAdHocTask(
      req.params.orgId,
      req.params.taskId,
      assigneeId || null,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding assignAdHoc');
  }
};

export const completeAdHoc = async (req, res) => {
  try {
    const data = await onboardingService.completeAdHocTask(
      req.params.orgId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding completeAdHoc');
  }
};

export const ignoreAdHoc = async (req, res) => {
  try {
    const data = await onboardingService.ignoreAdHocTask(
      req.params.orgId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding ignoreAdHoc');
  }
};

export const reopenAdHoc = async (req, res) => {
  try {
    const data = await onboardingService.reopenAdHocTask(
      req.params.orgId,
      req.params.taskId,
      req.user.userId
    );
    res.json({ data });
  } catch (err) {
    handleError(res, err, 'admin onboarding reopenAdHoc');
  }
};
export const listAdHoc = async (req, res) => {
  try {
    const { status, orgId, overdue, page, limit } = req.query;
    const result = await onboardingService.listAdHocTasks({
      status,
      orgId,
      overdue: overdue === 'true' ? true : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    res.json({
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    handleError(res, err, 'admin onboarding listAdHoc');
  }
};