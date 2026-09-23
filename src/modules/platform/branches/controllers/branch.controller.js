// src/modules/platform/branches/controllers/branch.controller.js

import branchService from '../services/branch.service.js';
import branchValidator from '../validators/branch.validator.js';
import orgDb from '../../organizations/db/org.db.js';
import branchDb from '../db/branch.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';

// ============================================================
// PERMISSION HELPER
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.manage');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create branches' });
    }

    const branch = await branchService.createBranch(userId, organizationId, req.body);
    res.status(201).json({ branch });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Branch code already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranches = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const { isActive, limit, offset } = req.query;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view branches' });
    }

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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view branches' });
    }

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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.manage');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to update branches' });
    }

    const branch = await branchService.updateBranch(organizationId, userId, branchId, req.body);
    res.status(200).json({ branch });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Branch code already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.manage');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete branches' });
    }

    const branch = await branchService.deleteBranch(organizationId, userId, branchId);
    res.status(200).json({ message: 'Branch deactivated successfully', branch });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const hasPermission = await checkPermission(userId, organizationId, 'branches.manage');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to assign branches' });
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
    if (
      error.message === 'Member not found in this organization' ||
      error.message === 'Member already has access to this branch'
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Assign branch to member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeBranchFromMember = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const hasPermission = await checkPermission(userId, organizationId, 'branches.manage');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to remove branch access' });
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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, memberId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'members.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view member branches' });
    }

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
    if (error.message === 'Member not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get member branches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// USER'S OWN BRANCHES (no permission gate)
// ============================================================

const getMyBranches = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const branches = await branchService.getUserBranches(userId, organizationId);
    res.status(200).json({ branches });
  } catch (error) {
    console.error('Get my branches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// BRANCH MEMBERS
// ============================================================

const getBranchMembers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'branches.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view branch members' });
    }

    const branch = await branchDb.findBranchById(branchId, organizationId);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const assignments = await branchDb.findAssignmentsByBranch(branchId);
    const members = assignments.map((a) => ({
      id: a.membership.id,
      userId: a.membership.userId,
      user: {
        id: a.membership.user.id,
        email: a.membership.user.email,
        firstName: a.membership.user.firstName,
        lastName: a.membership.user.lastName,
      },
      roleId: a.membership.roleId,
      isActive: a.membership.isActive,
      joinedAt: a.membership.joinedAt,
    }));

    res.status(200).json({ members });
  } catch (error) {
    console.error('Get branch members error:', error);
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
  getMyBranches,
  getBranchMembers,
};