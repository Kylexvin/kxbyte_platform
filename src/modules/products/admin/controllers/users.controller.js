// src/modules/products/admin/controllers/users.controller.js

import usersService from '../services/users.service.js';

const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  REASON_REQUIRED: 400,
  ALREADY_DEACTIVATED: 400,
  ALREADY_ACTIVE: 400,
  ALREADY_VERIFIED: 400,
};

const handleError = (res, err, label) => {
  const status = STATUS_BY_CODE[err.code] || 500;
  if (status >= 500) console.error(`${label} error:`, err);
  res.status(status).json({ error: err.message });
};

const parseBool = (v) => {
  if (v === undefined) return undefined;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return undefined;
};

export const list = async (req, res) => {
  try {
    const { search, hasOrg, isActive, isEmailVerified, orgId, sort, order, page, limit } = req.query;
    const result = await usersService.listUsers({
      search,
      hasOrg: parseBool(hasOrg),
      isActive: parseBool(isActive),
      isEmailVerified: parseBool(isEmailVerified),
      orgId,
      sort,
      order,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    res.json({
      data: result.users,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    handleError(res, err, 'admin users list');
  }
};

export const getOne = async (req, res) => {
  try {
    const user = await usersService.getUserDetail(req.params.userId);
    if (!req.platformPermissions?.['admin.users.sessions.view']) {
      delete user.sessions;
    }
    res.json({ data: user });
  } catch (err) {
    handleError(res, err, 'admin user detail');
  }
};

export const deactivate = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const user = await usersService.deactivateUser(req.params.userId, req.user.userId, reason);
    res.json({ data: user });
  } catch (err) {
    handleError(res, err, 'admin user deactivate');
  }
};

export const reactivate = async (req, res) => {
  try {
    const user = await usersService.reactivateUser(req.params.userId, req.user.userId);
    res.json({ data: user });
  } catch (err) {
    handleError(res, err, 'admin user reactivate');
  }
};

export const resendVerification = async (req, res) => {
  try {
    const result = await usersService.resendVerification(
      req.params.userId,
      req.user.userId,
      req
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin user resend-verification');
  }
};

export const forceLogout = async (req, res) => {
  try {
    const result = await usersService.forceLogout(req.params.userId, req.user.userId);
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin user force-logout');
  }
};