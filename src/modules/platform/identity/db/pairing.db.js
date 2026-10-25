// src/modules/platform/identity/db/pairing.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createSession = async (data) => {
  return prisma.pairingSession.create({ data });
};

const findByTokenHash = async (tokenHash) => {
  return prisma.pairingSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isEmailVerified: true,
        },
      },
      organization: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
};

const markUsed = async (id) => {
  return prisma.pairingSession.update({
    where: { id },
    data: { usedAt: new Date() },
  });
};

const revoke = async (id) => {
  return prisma.pairingSession.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
};

const deleteExpiredBefore = async (cutoff) => {
  return prisma.pairingSession.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
};

const findById = async (id) => {
  return prisma.pairingSession.findUnique({ where: { id } });
};

export default {
  createSession,
  findByTokenHash,
  markUsed,
  revoke,
  findById,
  deleteExpiredBefore,
};