// src/modules/products/kxtill/shift/services/shift.service.js

import prisma from '../../../../../database/postgres/prisma.js';
import shiftDb from '../db/shift.db.js';
import settingDb from '../db/setting.db.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import branchDb from '../../../../platform/branches/db/branch.db.js';
import audit from '../../../../platform/audit/index.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// HELPERS
// ============================================================

const computeExpectedCash = async (shift) => {
  const openingFloat = Number(shift.openingFloat);
  const cashIn = await shiftDb.sumCashPaymentsByShift(shift.id);
  const cashOut = await shiftDb.sumCashRefundsByShift(shift.id);
  return openingFloat + cashIn - cashOut;
};

const getThreshold = async (branchId) => {
  const setting = await settingDb.findSettingByBranch(branchId);
  return setting ? Number(setting.varianceThreshold) : 50;
};

const resolveCloseStatus = (variance, threshold) => {
  return Math.abs(variance) > threshold ? 'CLOSED_PENDING_REVIEW' : 'CLOSED';
};

// ============================================================
// OPEN SHIFT
// ============================================================

const openShift = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const branch = await branchDb.findBranchById(data.branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  const setting = await settingDb.findSettingByBranch(data.branchId);
  if (!setting || !setting.shiftsEnabled) {
    throw new Error('Shifts are not enabled for this branch');
  }

  const userOpen = await shiftDb.findOpenShiftByUser(userId, organizationId);
  if (userOpen) {
    throw new Error('You already have an open shift');
  }

  const branchOpen = await shiftDb.findOpenShiftByBranch(data.branchId, data.tillId || null);
  if (branchOpen) {
    throw new Error('This branch already has an open shift');
  }

  const shift = await shiftDb.createShift({
    organizationId,
    branchId: data.branchId,
    userId,
    openedById: userId,
    tillId: data.tillId || null,
    openingFloat: data.openingFloat,
    status: 'OPEN',
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_OPENED',
    resource: 'shift',
    resourceId: shift.id,
    metadata: {
      branchId: data.branchId,
      openingFloat: Number(data.openingFloat),
      tillId: data.tillId || null,
    },
  });

  return shiftDb.findShiftById(shift.id, organizationId);
};

// ============================================================
// CLOSE SHIFT (cashier)
// ============================================================

const closeShift = async (userId, organizationId, shiftId, declaredCash) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.userId !== userId) {
    throw new Error('You can only close your own shift');
  }

  if (shift.status !== 'OPEN') {
    throw new Error('Shift is not open');
  }

  const expectedCash = await computeExpectedCash(shift);
  const declared = Number(declaredCash);
  const variance = declared - expectedCash;
  const threshold = await getThreshold(shift.branchId);
  const status = resolveCloseStatus(variance, threshold);

  const updated = await shiftDb.closeShift(shift.id, {
    status,
    closureType: 'CASHIER',
    declaredCash: declared,
    expectedCash,
    variance,
    closedById: userId,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_CLOSED',
    resource: 'shift',
    resourceId: shift.id,
    metadata: {
      branchId: shift.branchId,
      expectedCash,
      declaredCash: declared,
      variance,
      status,
    },
  });

  return shiftDb.findShiftById(updated.id, organizationId);
};

// ============================================================
// CANCEL SHIFT (zero activity only)
// ============================================================

const cancelShift = async (userId, organizationId, shiftId) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.userId !== userId) {
    throw new Error('You can only cancel your own shift');
  }

  if (shift.status !== 'OPEN') {
    throw new Error('Only open shifts can be cancelled');
  }

  const salesCount = await shiftDb.countSalesByShift(shiftId);
  if (salesCount > 0) {
    throw new Error('Cannot cancel a shift with sales attached');
  }

  const updated = await shiftDb.cancelShift(shiftId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_CANCELLED',
    resource: 'shift',
    resourceId: shiftId,
    metadata: {
      branchId: shift.branchId,
      openingFloat: Number(shift.openingFloat),
    },
  });

  return updated;
};

// ============================================================
// FORCE CLOSE (manager)
// ============================================================

const forceCloseShift = async (userId, organizationId, shiftId, declaredCash, reason = null) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.status !== 'OPEN') {
    throw new Error('Shift is not open');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.shift.force_close');
  if (!hasPermission) {
    throw new Error('You do not have permission to force close shifts');
  }

  const expectedCash = await computeExpectedCash(shift);
  const declared = Number(declaredCash);
  const variance = declared - expectedCash;
  const threshold = await getThreshold(shift.branchId);
  const status = resolveCloseStatus(variance, threshold);

  const updated = await shiftDb.closeShift(shift.id, {
    status,
    closureType: 'MANAGER_FORCE',
    declaredCash: declared,
    expectedCash,
    variance,
    closedById: userId,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_FORCE_CLOSED',
    resource: 'shift',
    resourceId: shift.id,
    metadata: {
      branchId: shift.branchId,
      shiftOwnerId: shift.userId,
      expectedCash,
      declaredCash: declared,
      variance,
      status,
      reason,
    },
  });

  return shiftDb.findShiftById(updated.id, organizationId);
};

// ============================================================
// HANDOVER
// ============================================================

const requestHandover = async (userId, organizationId, shiftId, note = null) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.userId === userId) {
    throw new Error('You cannot request handover on your own shift');
  }

  if (shift.status !== 'OPEN') {
    throw new Error('Handover can only be requested on an open shift');
  }

  if (shift.handoverRequestedById) {
    throw new Error('Handover already requested for this shift');
  }

  const updated = await shiftDb.updateShift(shiftId, {
    handoverRequestedById: userId,
    handoverNote: note,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_HANDOVER_REQUESTED',
    resource: 'shift',
    resourceId: shiftId,
    metadata: {
      branchId: shift.branchId,
      shiftOwnerId: shift.userId,
      note,
    },
  });

  return updated;
};

const resolveHandover = async (userId, organizationId, shiftId, declaredCash, note = null) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.shift.resolve_handover');
  if (!hasPermission) {
    throw new Error('You do not have permission to resolve handovers');
  }

  if (!shift.handoverRequestedById) {
    throw new Error('No handover request exists for this shift');
  }

  if (shift.status !== 'OPEN') {
    throw new Error('Shift is not open');
  }

  const expectedCash = await computeExpectedCash(shift);
  const declared = Number(declaredCash);
  const variance = declared - expectedCash;
  const threshold = await getThreshold(shift.branchId);
  const status = resolveCloseStatus(variance, threshold);

  const updated = await shiftDb.updateShift(shiftId, {
    status,
    closureType: 'HANDOVER',
    declaredCash: declared,
    expectedCash,
    variance,
    closedById: userId,
    closedAt: new Date(),
    handoverResolvedById: userId,
    handoverResolvedAt: new Date(),
    handoverNote: note || shift.handoverNote,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_HANDOVER_RESOLVED',
    resource: 'shift',
    resourceId: shiftId,
    metadata: {
      branchId: shift.branchId,
      shiftOwnerId: shift.userId,
      expectedCash,
      declaredCash: declared,
      variance,
      status,
      note,
    },
  });

  return shiftDb.findShiftById(updated.id, organizationId);
};

const rejectHandover = async (userId, organizationId, shiftId, note = null) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.shift.resolve_handover');
  if (!hasPermission) {
    throw new Error('You do not have permission to reject handovers');
  }

  if (!shift.handoverRequestedById) {
    throw new Error('No handover request exists for this shift');
  }

  const updated = await shiftDb.updateShift(shiftId, {
    handoverRequestedById: null,
    handoverNote: note,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_HANDOVER_REJECTED',
    resource: 'shift',
    resourceId: shiftId,
    metadata: {
      branchId: shift.branchId,
      shiftOwnerId: shift.userId,
      note,
    },
  });

  return updated;
};

// ============================================================
// VARIANCE REVIEW
// ============================================================

const reviewVariance = async (userId, organizationId, shiftId, note) => {
  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.shift.resolve_variance');
  if (!hasPermission) {
    throw new Error('You do not have permission to review variance');
  }

  if (shift.status !== 'CLOSED_PENDING_REVIEW') {
    throw new Error('Shift is not pending review');
  }

  const updated = await shiftDb.updateShift(shiftId, {
    status: 'CLOSED',
    varianceReviewedById: userId,
    varianceReviewedAt: new Date(),
    varianceNote: note,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SHIFT_VARIANCE_REVIEWED',
    resource: 'shift',
    resourceId: shiftId,
    metadata: {
      branchId: shift.branchId,
      shiftOwnerId: shift.userId,
      variance: Number(shift.variance),
      note,
    },
  });

  return shiftDb.findShiftById(updated.id, organizationId);
};

// ============================================================
// READS
// ============================================================

const getCurrentShift = async (userId, organizationId) => {
  const shift = await shiftDb.findOpenShiftByUser(userId, organizationId);
  if (!shift) return null;
  return shiftDb.findShiftById(shift.id, organizationId);
};

const getShifts = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return shiftDb.findShiftsByOrganization(organizationId, filters);
};

const getShift = async (organizationId, userId, shiftId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const shift = await shiftDb.findShiftById(shiftId, organizationId);
  if (!shift) {
    throw new Error('Shift not found');
  }

  return shift;
};

const getPendingReview = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return shiftDb.findPendingReviewShifts(organizationId);
};

export default {
  openShift,
  closeShift,
  cancelShift,
  forceCloseShift,
  requestHandover,
  resolveHandover,
  rejectHandover,
  reviewVariance,
  getCurrentShift,
  getShifts,
  getShift,
  getPendingReview,
};