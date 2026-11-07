// src/modules/products/admin/services/users.service.js

import prisma from '../../../../database/postgres/prisma.js';
import userDb from '../db/user.db.js';
import authDb from '../../../platform/identity/db/auth.db.js';
import authService from '../../../platform/identity/services/auth.service.js';
import audit from '../../../platform/audit/index.js';

// ============================================================
// ERRORS
// ============================================================

const notFound = (message = 'User not found') => {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  return err;
};

const badRequest = (message, code = 'BAD_REQUEST') => {
  const err = new Error(message);
  err.code = code;
  return err;
};

// ============================================================
// LIST / DETAIL
// ============================================================

const listUsers = async (filters = {}) => {
  const { page = 1, limit = 50 } = filters;
  const { users, total } = await userDb.findUsers({ ...filters, page, limit });
  return { users, total, page, limit };
};

const getUserDetail = async (userId) => {
  const user = await userDb.findUserDetail(userId);
  if (!user) throw notFound();
  return user;
};

// ============================================================
// DEACTIVATE / REACTIVATE
// ============================================================

const deactivateUser = async (userId, actorId, reason) => {
  if (!reason || !reason.trim()) {
    throw badRequest('Deactivation reason is required', 'REASON_REQUIRED');
  }

  const user = await authDb.findUserById(userId);
  if (!user) throw notFound();

  if (!user.isActive) {
    throw badRequest('User is already deactivated', 'ALREADY_DEACTIVATED');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: actorId,
      deactivationReason: reason.trim(),
    },
  });

  await authDb.revokeAllUserSessions(userId);

  await audit.log({
    organizationId: null,
    userId: actorId,
    action: 'USER_DEACTIVATED',
    resource: 'user',
    resourceId: userId,
    metadata: {
      targetUserId: userId,
      targetEmail: user.email,
      reason: reason.trim(),
    },
  });

  return updated;
};

const reactivateUser = async (userId, actorId) => {
  const user = await authDb.findUserById(userId);
  if (!user) throw notFound();

  if (user.isActive) {
    throw badRequest('User is already active', 'ALREADY_ACTIVE');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
    },
  });

  await audit.log({
    organizationId: null,
    userId: actorId,
    action: 'USER_REACTIVATED',
    resource: 'user',
    resourceId: userId,
    metadata: {
      targetUserId: userId,
      targetEmail: user.email,
      previousDeactivationReason: user.deactivationReason || null,
    },
  });

  return updated;
};

// ============================================================
// RESEND VERIFICATION
// ============================================================

const resendVerification = async (userId, actorId, req = null) => {
  const user = await authDb.findUserById(userId);
  if (!user) throw notFound();

  if (user.isEmailVerified) {
    throw badRequest('User email is already verified', 'ALREADY_VERIFIED');
  }

  await authService.resendVerification(user.email, req);

  await audit.log({
    organizationId: null,
    userId: actorId,
    action: 'USER_VERIFICATION_RESENT_BY_ADMIN',
    resource: 'user',
    resourceId: userId,
    metadata: {
      targetUserId: userId,
      targetEmail: user.email,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  return { message: 'Verification email sent' };
};

// ============================================================
// FORCE LOGOUT
// ============================================================

const forceLogout = async (userId, actorId) => {
  const user = await authDb.findUserById(userId);
  if (!user) throw notFound();

  const result = await authDb.revokeAllUserSessions(userId);

  await audit.log({
    organizationId: null,
    userId: actorId,
    action: 'USER_FORCED_LOGOUT',
    resource: 'user',
    resourceId: userId,
    metadata: {
      targetUserId: userId,
      targetEmail: user.email,
      sessionsRevoked: result.count,
    },
  });

  return { message: 'All sessions revoked', sessionsRevoked: result.count };
};

export default {
  listUsers,
  getUserDetail,
  deactivateUser,
  reactivateUser,
  resendVerification,
  forceLogout,
};