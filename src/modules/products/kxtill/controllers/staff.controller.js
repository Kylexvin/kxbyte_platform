// src/modules/products/kxtill/controllers/staff.controller.js

import staffService from '../services/staff.service.js';

// ============================================================
// GET /organizations/:organizationId/kxtill/staff
// Query: ?includeInactive=true (optional)
// ============================================================
const getStaff = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await staffService.getKxTillStaff(
      organizationId,
      userId,
      { includeInactive }
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, targetUserId } = req.params;
    const result = await staffService.updateStaffMember(
      organizationId,
      userId,
      targetUserId,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can update staff members') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User is not a member of this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeStaff = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, targetUserId } = req.params;
    const result = await staffService.removeKxTillAccess(
      organizationId,
      userId,
      targetUserId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can remove staff access') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User is not a member of this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Remove staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getStaff,
  updateStaff,
  removeStaff,
};