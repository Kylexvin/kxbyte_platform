// src/modules/products/kxtill/services/staff.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import permissionDb from '../../../platform/authorization/db/permission.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';
import audit from '../../../platform/audit/index.js';

const getKxTillStaff = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Get organization owner
  const org = await orgDb.findOrganizationById(organizationId);
  const members = await orgDb.findMembershipsByOrganization(organizationId);

  const staff = [];
  const stats = {
    total: 0,
    active: 0,
    inactive: 0,
    owners: 0,
    managers: 0,
    staff: 0,
  };

  for (const member of members) {
    const isOwner = member.userId === org.ownerId;
    
    let kxTillPermissions = [];

    if (isOwner) {
      // Owner has all permissions
      kxTillPermissions = await permissionDb.findPermissionsByProduct('kxtill');
    } else {
      const userPermissions = await permissionDb.findPermissionsByUser(member.userId, organizationId);
      kxTillPermissions = userPermissions.filter(p => p.key.startsWith('kxtill.'));
    }

    if (kxTillPermissions.length === 0) {
      continue;
    }

    stats.total++;

    const assignments = await branchDb.findAssignmentsByMembership(member.id);
    const branches = assignments.map(a => a.branch);

    let role = null;
    if (member.roleId) {
      const roleData = await prisma.role.findUnique({
        where: { id: member.roleId },
        select: { id: true, name: true },
      });
      role = roleData;
    }

    if (isOwner) {
      stats.owners++;
    } else if (role?.name?.toLowerCase() === 'manager' || 
               kxTillPermissions.some(p => p.key === 'kxtill.settings.update')) {
      stats.managers++;
    } else {
      stats.staff++;
    }

    if (member.isActive) {
      stats.active++;
    } else {
      stats.inactive++;
    }

    staff.push({
      userId: member.userId,
      user: member.user,
      isActive: member.isActive,
      hasAllBranches: member.hasAllBranches || false,
      joinedAt: member.joinedAt,
      role,
      permissions: kxTillPermissions.map(p => ({
        id: p.id,
        key: p.key,
        name: p.name,
        productKey: p.productKey,
      })),
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isDefault: b.isDefault,
      })),
    });
  }

  return { staff, stats };
};
const updateStaffMember = async (organizationId, userId, targetUserId, data) => {
  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) {
    throw new Error('Organization not found');
  }

  if (org.ownerId !== userId) {
    throw new Error('Only the organization owner can update staff members');
  }

  const membership = await orgDb.findMembership(targetUserId, organizationId);
  if (!membership) {
    throw new Error('User is not a member of this organization');
  }

  if (data.isActive !== undefined) {
    await orgDb.updateMembership(membership.id, { isActive: data.isActive });
  }

  if (data.branchIds !== undefined) {
    const existing = await branchDb.findAssignmentsByMembership(membership.id);
    for (const assignment of existing) {
      await branchDb.removeBranchAssignment(membership.id, assignment.branchId);
    }

    for (const branchId of data.branchIds) {
      await branchDb.assignBranchToMembership(membership.id, branchId);
    }
  }

  if (data.roleId !== undefined) {
    await orgDb.updateMembership(membership.id, { roleId: data.roleId || null });
  }

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_STAFF_UPDATED',
    resource: 'staff',
    resourceId: targetUserId,
    metadata: {
      updatedFields: Object.keys(data),
      targetUserId,
    },
  });

  return { success: true, userId: targetUserId };
};

const removeKxTillAccess = async (organizationId, userId, targetUserId) => {
  const org = await orgDb.findOrganizationById(organizationId);
  if (!org) {
    throw new Error('Organization not found');
  }

  if (org.ownerId !== userId) {
    throw new Error('Only the organization owner can remove staff access');
  }

  const membership = await orgDb.findMembership(targetUserId, organizationId);
  if (!membership) {
    throw new Error('User is not a member of this organization');
  }

  const userPermissions = await permissionDb.findPermissionsByUser(targetUserId, organizationId);
  const kxTillPermissions = userPermissions.filter(p => p.key.startsWith('kxtill.'));

  await orgDb.updateMembership(membership.id, { isActive: false });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_STAFF_REMOVED',
    resource: 'staff',
    resourceId: targetUserId,
    metadata: {
      targetUserId,
      removedPermissions: kxTillPermissions.map(p => p.key),
    },
  });

  return { success: true, userId: targetUserId };
};

export default {
  getKxTillStaff,
  updateStaffMember,
  removeKxTillAccess,
};