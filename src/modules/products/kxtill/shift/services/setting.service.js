// src/modules/products/kxtill/shift/services/setting.service.js

import prisma from '../../../../../database/postgres/prisma.js';
import settingDb from '../db/setting.db.js';
import shiftDb from '../db/shift.db.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import branchDb from '../../../../platform/branches/db/branch.db.js';
import audit from '../../../../platform/audit/index.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// GET SETTING
// ============================================================

const getSetting = async (organizationId, userId, branchId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  const setting = await settingDb.findSettingByBranch(branchId);

  if (!setting) {
    return {
      branchId,
      shiftsEnabled: false,
      varianceThreshold: 50,
      isDefault: true,
    };
  }

  return {
    branchId: setting.branchId,
    shiftsEnabled: setting.shiftsEnabled,
    varianceThreshold: Number(setting.varianceThreshold),
    isDefault: false,
  };
};

// ============================================================
// UPDATE SETTING
// ============================================================

const updateSetting = async (organizationId, userId, branchId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.shift.settings');
  if (!hasPermission) {
    throw new Error('You do not have permission to manage shift settings');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  const updateData = {};
  if (data.shiftsEnabled !== undefined) updateData.shiftsEnabled = data.shiftsEnabled;
  if (data.varianceThreshold !== undefined) updateData.varianceThreshold = data.varianceThreshold;

  const setting = await settingDb.upsertSetting(branchId, updateData);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_SETTING_UPDATED',
    resource: 'shift_setting',
    resourceId: setting.id,
    metadata: {
      branchId,
      changes: updateData,
    },
  });

  if (data.shiftsEnabled === false) {
    const allOpen = await prisma.kxTillShift.findMany({
      where: { branchId, status: 'OPEN', deletedAt: null },
    });

    for (const shift of allOpen) {
      await shiftDb.updateShift(shift.id, {
        status: 'CLOSED',
        closureType: 'SYSTEM',
        declaredCash: null,
        expectedCash: null,
        variance: null,
        closedAt: new Date(),
      });

      await audit.log({
        organizationId,
        userId,
        action: 'KXTILL_SHIFT_SYSTEM_CLOSED',
        resource: 'shift',
        resourceId: shift.id,
        metadata: {
          branchId,
          reason: 'shifts_disabled',
          shiftOwnerId: shift.userId,
        },
      });
    }
  }

  return {
    branchId: setting.branchId,
    shiftsEnabled: setting.shiftsEnabled,
    varianceThreshold: Number(setting.varianceThreshold),
  };
};

export default {
  getSetting,
  updateSetting,
};