// src/modules/platform/branches/controllers/branch.controller.js

import branchService from '../services/branch.service.js';
import branchValidator from '../validators/branch.validator.js';

// ============================================================
// BRANCH CRUD
// ============================================================

const createBranch = async (req, res) => {
  const validation = branchValidator.validateCreateBranch(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const branch = await branchService.createBranch(userId, organizationId, req.body);
    res.status(201).json({ branch });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can create branches' ||
        error.message === 'Branch code already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranches = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { isActive, limit, offset } = req.query;
    const result = await branchService.getBranches(organizationId, userId, {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranch = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const branch = await branchService.getBranch(organizationId, userId, branchId);
    res.status(200).json({ branch });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateBranch = async (req, res) => {
  const validation = branchValidator.validateUpdateBranch(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const branch = await branchService.updateBranch(organizationId, userId, branchId, req.body);
    res.status(200).json({ branch });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can update branches' ||
        error.message === 'Branch code already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const branch = await branchService.deleteBranch(organizationId, userId, branchId);
    res.status(200).json({ message: 'Branch deactivated successfully', branch });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can delete branches') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Cannot delete the default branch') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// BRANCH ASSIGNMENTS
// ============================================================

const assignBranchToMember = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const assignment = await branchService.assignBranchToMember(
      organizationId,
      userId,
      memberId,
      branchId
    );
    res.status(201).json({ assignment });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can assign branches to members') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Member not found in this organization' ||
        error.message === 'Member already has access to this branch') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Assign branch to member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeBranchFromMember = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const result = await branchService.removeBranchFromMember(
      organizationId,
      userId,
      memberId,
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can remove branch access') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Member not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Member has all branches access. Remove that permission first.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Remove branch from member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMemberBranches = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, memberId } = req.params;

    const branches = await branchService.getMemberBranches(
      organizationId,
      userId,
      memberId
    );
    res.status(200).json({ branches });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can view member branches') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Member not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get member branches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createBranch,
  getBranches,
  getBranch,
  updateBranch,
  deleteBranch,
  assignBranchToMember,
  removeBranchFromMember,
  getMemberBranches,
};