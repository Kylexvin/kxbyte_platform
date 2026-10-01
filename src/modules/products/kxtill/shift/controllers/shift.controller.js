// src/modules/products/kxtill/shift/controllers/shift.controller.js

import shiftService from '../services/shift.service.js';

// ============================================================
// ERROR MAPPER
// ============================================================

const mapError = (res, error, fallbackMessage = 'Internal server error') => {
  const msg = error.message || '';

  if (
    msg === 'Organization not found' ||
    msg === 'Branch not found' ||
    msg === 'Shift not found'
  ) {
    return res.status(404).json({ error: msg });
  }

  if (
    msg === 'You do not have access to this organization' ||
    msg === 'You do not have permission to open shifts' ||
    msg === 'You do not have permission to force close shifts' ||
    msg === 'You do not have permission to resolve handovers' ||
    msg === 'You do not have permission to review variance' ||
    msg === 'You do not have permission to view shifts' ||
    msg === 'You can only close your own shift' ||
    msg === 'You can only cancel your own shift'
  ) {
    return res.status(403).json({ error: msg });
  }

  if (
    msg === 'Shifts are not enabled for this branch' ||
    msg === 'You already have an open shift' ||
    msg === 'This branch already has an open shift' ||
    msg === 'Shift is not open' ||
    msg === 'Only open shifts can be cancelled' ||
    msg === 'Cannot cancel a shift with sales attached' ||
    msg === 'Handover already requested for this shift' ||
    msg === 'No handover request exists for this shift' ||
    msg === 'You cannot request handover on your own shift' ||
    msg === 'Handover can only be requested on an open shift' ||
    msg === 'Shift is not pending review'
  ) {
    return res.status(400).json({ error: msg });
  }

  console.error('Shift controller error:', error);
  return res.status(500).json({ error: fallbackMessage });
};

// ============================================================
// OPEN
// ============================================================

const openShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const shift = await shiftService.openShift(userId, organizationId, req.body);
    return res.status(201).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to open shift');
  }
};

// ============================================================
// CLOSE (cashier)
// ============================================================

const closeShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { declaredCash } = req.body;
    const shift = await shiftService.closeShift(userId, organizationId, shiftId, declaredCash);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to close shift');
  }
};

// ============================================================
// CANCEL
// ============================================================

const cancelShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const shift = await shiftService.cancelShift(userId, organizationId, shiftId);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to cancel shift');
  }
};

// ============================================================
// FORCE CLOSE (manager)
// ============================================================

const forceCloseShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { declaredCash, reason } = req.body;
    const shift = await shiftService.forceCloseShift(
      userId,
      organizationId,
      shiftId,
      declaredCash,
      reason || null
    );
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to force close shift');
  }
};

// ============================================================
// CURRENT
// ============================================================

const getCurrentShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const shift = await shiftService.getCurrentShift(userId, organizationId);
    return res.status(200).json({ shift: shift || null });
  } catch (error) {
    return mapError(res, error, 'Failed to fetch current shift');
  }
};

// ============================================================
// PENDING REVIEW
// ============================================================

const getPendingReview = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const shifts = await shiftService.getPendingReview(organizationId, userId);
    return res.status(200).json({ shifts });
  } catch (error) {
    return mapError(res, error, 'Failed to fetch pending review shifts');
  }
};

// ============================================================
// GET ONE
// ============================================================

const getShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const shift = await shiftService.getShift(organizationId, userId, shiftId);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to fetch shift');
  }
};

// ============================================================
// LIST
// ============================================================

const getShifts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const {
      limit,
      offset,
      branchId,
      userId: filterUserId,
      status,
      startDate,
      endDate,
      includeDeleted,
    } = req.query;

    const filters = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      branchId,
      userId: filterUserId,
      status,
      startDate,
      endDate,
      includeDeleted: includeDeleted === 'true',
    };

    const result = await shiftService.getShifts(organizationId, userId, filters);
    return res.status(200).json(result);
  } catch (error) {
    return mapError(res, error, 'Failed to fetch shifts');
  }
};

// ============================================================
// HANDOVER
// ============================================================

const requestHandover = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { note } = req.body;
    const shift = await shiftService.requestHandover(userId, organizationId, shiftId, note || null);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to request handover');
  }
};

const resolveHandover = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { declaredCash, note } = req.body;
    const shift = await shiftService.resolveHandover(
      userId,
      organizationId,
      shiftId,
      declaredCash,
      note || null
    );
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to resolve handover');
  }
};

const rejectHandover = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { note } = req.body;
    const shift = await shiftService.rejectHandover(userId, organizationId, shiftId, note || null);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to reject handover');
  }
};

// ============================================================
// VARIANCE REVIEW
// ============================================================

const reviewVariance = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, shiftId } = req.params;
    const { note } = req.body;
    const shift = await shiftService.reviewVariance(userId, organizationId, shiftId, note);
    return res.status(200).json({ shift });
  } catch (error) {
    return mapError(res, error, 'Failed to review variance');
  }
};

export default {
  openShift,
  closeShift,
  cancelShift,
  forceCloseShift,
  getCurrentShift,
  getPendingReview,
  getShift,
  getShifts,
  requestHandover,
  resolveHandover,
  rejectHandover,
  reviewVariance,
};