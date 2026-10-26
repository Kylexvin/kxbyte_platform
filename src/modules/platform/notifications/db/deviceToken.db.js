// src/modules/platform/notifications/db/deviceToken.db.js

import prisma from '../../../../database/postgres/prisma.js';

const upsert = async ({ userId, productKey, token, platform, deviceLabel }) => {
  return prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId,
      productKey,
      platform,
      deviceLabel: deviceLabel || null,
      lastSeenAt: new Date(),
    },
    create: {
      userId,
      productKey,
      token,
      platform,
      deviceLabel: deviceLabel || null,
    },
  });
};

const findByUserAndProduct = async (userId, productKey) => {
  return prisma.deviceToken.findMany({
    where: { userId, productKey },
  });
};

const deleteByToken = async (token) => {
  return prisma.deviceToken.deleteMany({ where: { token } });
};

const deleteForUser = async (userId) => {
  return prisma.deviceToken.deleteMany({ where: { userId } });
};

export default {
  upsert,
  findByUserAndProduct,
  deleteByToken,
  deleteForUser,
};