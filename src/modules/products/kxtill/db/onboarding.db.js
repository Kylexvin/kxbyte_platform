// src/modules/products/kxtill/db/onboarding.db.js

import prisma from '../../../../database/postgres/prisma.js';

const findByOrganization = async (organizationId) => {
  return prisma.kxTillOnboardingState.findUnique({
    where: { organizationId },
  });
};

const upsertByOrganization = async (organizationId, data) => {
  return prisma.kxTillOnboardingState.upsert({
    where: { organizationId },
    update: data,
    create: {
      organizationId,
      ...data,
    },
  });
};

const markDismissed = async (organizationId) => {
  return upsertByOrganization(organizationId, { isDismissed: true });
};

const markCompleted = async (organizationId) => {
  return upsertByOrganization(organizationId, {
    completedAt: new Date(),
  });
};

export default {
  findByOrganization,
  upsertByOrganization,
  markDismissed,
  markCompleted,
};