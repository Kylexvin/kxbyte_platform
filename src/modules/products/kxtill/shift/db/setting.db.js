// src/modules/products/kxtill/shift/db/setting.db.js

import prisma from '../../../../../database/postgres/prisma.js';

const findSettingByBranch = async (branchId) => {
  return prisma.kxTillBranchSetting.findUnique({
    where: { branchId },
  });
};

const upsertSetting = async (branchId, data) => {
  return prisma.kxTillBranchSetting.upsert({
    where: { branchId },
    update: data,
    create: {
      branchId,
      ...data,
    },
  });
};

export default {
  findSettingByBranch,
  upsertSetting,
};