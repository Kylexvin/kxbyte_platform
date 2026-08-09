// src/modules/products/kxtill/db/setting.db.js

import prisma from '../../../../database/postgres/prisma.js';

const findSettingByOrganization = async (organizationId) => {
  return prisma.kxTillStoreSetting.findUnique({
    where: { organizationId },
  });
};

const upsertSetting = async (organizationId, data) => {
  return prisma.kxTillStoreSetting.upsert({
    where: { organizationId },
    update: data,
    create: {
      organizationId,
      ...data,
    },
  });
};

const updateSetting = async (organizationId, data) => {
  return prisma.kxTillStoreSetting.update({
    where: { organizationId },
    data,
  });
};

export default {
  findSettingByOrganization,
  upsertSetting,
  updateSetting,
};