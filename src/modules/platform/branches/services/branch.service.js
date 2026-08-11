// src/modules/platform/branches/services/branch.service.js

import branchDb from '../db/branch.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';

// ============================================================
// BRANCH CRUD
// ============================================================

const createBranch = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can create branches');
  }

  // Check if code already exists
  const branches = await branchDb.findBranchesByOrganization(organizationId, { limit: 100 });
  if (branches.items.some(b => b.code === data.code)) {
    throw new Error('Branch code already exists');
  }

  const branch = await branchDb.createBranch({
    organizationId,
    name: data.name,
    code: data.code.toUpperCase(),
    address: data.address,
    phone: data.phone,
    email: data.email,
    isActive: true,
    isDefault: false,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'BRANCH_CREATED',
    resource: 'branch',
    resourceId: branch.id,
    metadata: {
      name: branch.name,
      code: branch.code,
    },
  });

  return branch;
};

const getBranches = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return branchDb.findBranchesByOrganization(organizationId, filters);
};

const getBranch = async (organizationId, userId, branchId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  return branch;
};

const updateBranch = async (organizationId, userId, branchId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can update branches');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Check if code already exists (if code is being updated)
  if (data.code && data.code !== branch.code) {
    const branches = await branchDb.findBranchesByOrganization(organizationId);
    if (branches.items.some(b => b.code === data.code)) {
      throw new Error('Branch code already exists');
    }
  }

  const updated = await branchDb.updateBranch(branchId, organizationId, data);

  await audit.log({
    organizationId,
    userId,
    action: 'BRANCH_UPDATED',
    resource: 'branch',
    resourceId: branchId,
    metadata: {
      name: updated.name,
      code: updated.code,
    },
  });

  return updated;
};

const deleteBranch = async (organizationId, userId, branchId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can delete branches');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  if (branch.isDefault) {
    throw new Error('Cannot delete the default branch');
  }

  const deleted = await branchDb.deleteBranch(branchId, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'BRANCH_DELETED',
    resource: 'branch',
    resourceId: branchId,
    metadata: {
      name: branch.name,
      code: branch.code,
    },
  });

  return deleted;
};

// ============================================================
// BRANCH ASSIGNMENTS
// ============================================================

const assignBranchToMember = async (organizationId, userId, memberId, branchId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can assign branches to members');
  }

  // Check if member exists in organization
  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  // Check if branch exists
  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Check if already assigned
  const hasAccess = await branchDb.hasBranchAccess(membership.id, branchId);
  if (hasAccess) {
    throw new Error('Member already has access to this branch');
  }

  const assignment = await branchDb.assignBranchToMembership(membership.id, branchId);

  await audit.log({
    organizationId,
    userId,
    action: 'BRANCH_ASSIGNED',
    resource: 'branch_assignment',
    resourceId: assignment.id,
    metadata: {
      memberId,
      branchId,
      branchName: branch.name,
    },
  });

  return assignment;
};

const removeBranchFromMember = async (organizationId, userId, memberId, branchId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can remove branch access');
  }

  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Check if member has all branches access
  if (membership.hasAllBranches) {
    throw new Error('Member has all branches access. Remove that permission first.');
  }

  await branchDb.removeBranchAssignment(membership.id, branchId);

  await audit.log({
    organizationId,
    userId,
    action: 'BRANCH_UNASSIGNED',
    resource: 'branch_assignment',
    metadata: {
      memberId,
      branchId,
      branchName: branch.name,
    },
  });

  return { message: 'Branch access removed' };
};

const getMemberBranches = async (organizationId, userId, memberId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can view member branches');
  }

  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  const assignments = await branchDb.findAssignmentsByMembership(membership.id);
  return assignments.map(a => a.branch);
};

// ============================================================
// BRANCH ACCESS CHECK (for authorization)
// ============================================================

const hasBranchAccess = async (membershipId, branchId) => {
  return branchDb.hasBranchAccess(membershipId, branchId);
};

const getUserBranches = async (userId, organizationId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    return [];
  }

  // If user has all branches access, return all branches
  if (membership.hasAllBranches) {
    const branches = await branchDb.findBranchesByOrganization(organizationId);
    return branches.items;
  }

  // Otherwise, return assigned branches
  const assignments = await branchDb.findAssignmentsByMembership(membership.id);
  return assignments.map(a => a.branch);
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
  hasBranchAccess,
  getUserBranches,
};