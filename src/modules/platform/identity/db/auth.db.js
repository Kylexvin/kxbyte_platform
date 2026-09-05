// src/modules/platform/identity/db/auth.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// USER OPERATIONS
// ============================================================

const createUser = async (data) => {
  return prisma.user.create({ data });
};

const findUserByEmail = async (email) => {
  return prisma.user.findUnique({ where: { email } });
};

const findActiveUserByEmail = async (email) => {
  return prisma.user.findFirst({
    where: {
      email,
      isActive: true,
      deletedAt: null,
    },
  });
};

const findUserById = async (id) => {
  return prisma.user.findUnique({ where: { id } });
};

const findActiveUserById = async (id) => {
  return prisma.user.findFirst({
    where: {
      id,
      isActive: true,
      deletedAt: null,
    },
  });
};

const updateUser = async (id, data) => {
  return prisma.user.update({ where: { id }, data });
};

const deactivateUser = async (id) => {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
};

const reactivateUser = async (id) => {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
  });
};

const softDeleteUser = async (id) => {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

// ============================================================
// SESSION OPERATIONS
// ============================================================

const createSession = async (data) => {
  return prisma.session.create({
    data: {
      ...data,
      isRevoked: false,
    },
  });
};

const findSessionByToken = async (refreshToken) => {
  return prisma.session.findUnique({
    where: { refreshToken },
  });
};

const findActiveSessionByToken = async (refreshToken) => {
  return prisma.session.findFirst({
    where: {
      refreshToken,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
  });
};

const findActiveSessionWithUser = async (refreshToken) => {
  return prisma.session.findFirst({
    where: {
      refreshToken,
      isRevoked: false,
      expiresAt: { gt: new Date() },
      user: {
        isActive: true,
        deletedAt: null,
      },
    },
    include: {
      user: true,
    },
  });
};

const markSessionUsed = async (id) => {
  return prisma.session.update({
    where: { id },
    data: { /* usedAt field doesn't exist in schema - skip or add it */ },
  });
};

const revokeSession = async (id) => {
  return prisma.session.update({
    where: { id },
    data: { isRevoked: true },
  });
};

const revokeAllUserSessions = async (userId) => {
  return prisma.session.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: { isRevoked: true },
  });
};

const deleteSession = async (id) => {
  return prisma.session.delete({ where: { id } });
};

const deleteAllSessionsByUserId = async (userId) => {
  return prisma.session.deleteMany({ where: { userId } });
};

const findSessionsByUserId = async (userId) => {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

const findActiveSessionsByUserId = async (userId) => {
  return prisma.session.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
};

// ============================================================
// VERIFICATION TOKEN OPERATIONS
// ============================================================

const createVerificationToken = async (data) => {
  return prisma.verificationToken.create({ data });
};

const findVerificationToken = async (token) => {
  return prisma.verificationToken.findUnique({
    where: { token },
  });
};

const findUnusedVerificationToken = async (token) => {
  return prisma.verificationToken.findFirst({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
};

const findUnusedVerificationTokenByType = async (token, type) => {
  return prisma.verificationToken.findFirst({
    where: {
      token,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
};

const updateVerificationToken = async (id, data) => {
  return prisma.verificationToken.update({ where: { id }, data });
};

const markVerificationTokenUsed = async (id) => {
  return prisma.verificationToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
};

const deleteVerificationToken = async (id) => {
  return prisma.verificationToken.delete({ where: { id } });
};

const deleteExpiredVerificationTokens = async () => {
  return prisma.verificationToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
};

const countPasswordResetRequests = async (email, timeWindowSeconds = 3600) => {
  const cutoff = new Date(Date.now() - timeWindowSeconds * 1000);
  return prisma.verificationToken.count({
    where: {
      user: { email },
      type: 'PASSWORD_RESET',
      createdAt: { gt: cutoff },
    },
  });
};

// ============================================================
// SOCIAL ACCOUNTS
// ============================================================

const findSocialAccount = async (provider, providerId) => {
  return prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider,
        providerId,
      },
    },
  });
};

const findSocialAccountByEmail = async (email, provider) => {
  return prisma.socialAccount.findFirst({
    where: {
      email,
      provider,
    },
  });
};

const findSocialAccountByUser = async (userId, provider) => {
  return prisma.socialAccount.findFirst({
    where: {
      userId,
      provider,
    },
  });
};

const createSocialAccount = async (data) => {
  return prisma.socialAccount.create({ data });
};

const deleteSocialAccount = async (id) => {
  return prisma.socialAccount.delete({ where: { id } });
};

// ============================================================
// ORGANIZATION LOOKUP
// ============================================================

const findOrganizationsByUserId = async (userId) => {
  return prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          userId,
          isActive: true,
        },
      },
    },
  });
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  // User
  createUser,
  findUserByEmail,
  findActiveUserByEmail,
  findUserById,
  findActiveUserById,
  updateUser,
  deactivateUser,
  reactivateUser,
  softDeleteUser,

  // Session
  createSession,
  findSessionByToken,
  findActiveSessionByToken,
  findActiveSessionWithUser,
  markSessionUsed,
  revokeSession,
  revokeAllUserSessions,
  deleteSession,
  deleteAllSessionsByUserId,
  findSessionsByUserId,
  findActiveSessionsByUserId,

  // Verification Token
  createVerificationToken,
  findVerificationToken,
  findUnusedVerificationToken,
  findUnusedVerificationTokenByType,
  updateVerificationToken,
  markVerificationTokenUsed,
  deleteVerificationToken,
  deleteExpiredVerificationTokens,
  countPasswordResetRequests,

  // Social
  findSocialAccount,
  findSocialAccountByEmail,
  findSocialAccountByUser,
  createSocialAccount,
  deleteSocialAccount,

  // Organization
  findOrganizationsByUserId,
};