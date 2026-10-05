// src/modules/products/kxtill/services/onboarding.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import onboardingDb from '../db/onboarding.db.js';
import settingDb from '../db/setting.db.js';

// ============================================================
// GET STATE
// ============================================================
const getOnboardingState = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) {
    throw new Error('Organization not found');
  }

  // Parallel fetches — cheap counts + settings row + dismissal state
  const [productCount, salesCount, settings, state] = await Promise.all([
    prisma.kxTillProduct.count({
      where: { organizationId, isActive: true },
    }),
    prisma.kxTillSale.count({
      where: { organizationId, status: 'COMPLETED' },
    }),
    settingDb.findSettingByOrganization(organizationId),
    onboardingDb.findByOrganization(organizationId),
  ]);

  // Store info is done as soon as ANY shop detail exists.
  // The user does not have to fill every field — one is enough.
  // org.name counts as a shop detail, so this is effectively "true" from
  // day one for every org. Tax number, phone, address are all optional.
  const hasAnyShopDetail = !!(
    settings?.shopName?.trim() ||
    settings?.shopPhone?.trim() ||
    settings?.shopEmail?.trim() ||
    settings?.shopAddress?.trim() ||
    settings?.taxNumber?.trim() ||
    org?.name?.trim()
  );
  const storeInfoDone = hasAnyShopDetail;

  const productDone = productCount > 0;
  const firstSaleDone = salesCount > 0;

  const steps = {
    storeInfo: { done: storeInfoDone },
    product: { done: productDone },
    firstSale: { done: firstSaleDone },
  };

  const completedCount =
    (storeInfoDone ? 1 : 0) +
    (productDone ? 1 : 0) +
    (firstSaleDone ? 1 : 0);

  const isComplete = firstSaleDone;

  // Persist completion time on first transition (idempotent, fire-and-forget)
  if (isComplete && !state?.completedAt) {
    onboardingDb.markCompleted(organizationId).catch((err) => {
      console.error('Failed to mark onboarding complete:', err);
    });
  }

  return {
    isComplete,
    isDismissed: !!state?.isDismissed,
    completedCount,
    totalCount: 3,
    steps,
  };
};

// ============================================================
// DISMISS
// ============================================================
const dismissOnboarding = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) {
    throw new Error('Organization not found');
  }
  if (org.ownerId !== userId) {
    throw new Error('Only the organization owner can dismiss onboarding');
  }

  const state = await onboardingDb.markDismissed(organizationId);
  return { isDismissed: !!state.isDismissed };
};

export default {
  getOnboardingState,
  dismissOnboarding,
};