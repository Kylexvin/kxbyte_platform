// src/modules/platform/organizations/services/org.service.js

import orgDb from '../db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import roleDb from '../../authorization/db/role.db.js';
import { getCountryDefaults } from '../utils/country.utils.js';
import { generateSlug } from '../utils/slug.utils.js';
import audit from '../../audit/index.js';
import prisma from '../../../../database/postgres/prisma.js';



const createOrganization = async (userId, data) => {
  const { name, country } = data;

  const slug = await generateSlug(name);
  const defaults = getCountryDefaults(country);

  const organization = await orgDb.createOrganization({
    name,
    slug,
    ownerId: userId,
    country: country.toUpperCase(),
    currency: defaults.currency,
    timezone: defaults.timezone,
  });

  const membership = await orgDb.createMembership({
    userId,
    organizationId: organization.id,
    isActive: true,
    hasAllBranches: true, // Owner has access to all branches
  });

 
  const defaultBranch = await prisma.branch.create({
    data: {
      organizationId: organization.id,
      name: 'Main Branch',
      code: 'MAIN',
      address: '',
      phone: '',
      email: '',
      isDefault: true,
      isActive: true,
    },
  });

  // Audit log: Organization created
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ORGANIZATION_CREATED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      name: organization.name,
      slug: organization.slug,
      country: organization.country,
    },
  });

  // Audit log: Default branch created
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'BRANCH_CREATED',
    resource: 'branch',
    resourceId: defaultBranch.id,
    metadata: {
      name: defaultBranch.name,
      code: defaultBranch.code,
    },
  });

  return {
    organization,
    membership,
    defaultBranch,
  };
};

const getOrganizations = async (userId) => {
  const organizations = await orgDb.findOrganizationsByUserId(userId);

  const enriched = await Promise.all(
    organizations.map(async (org) => {
      const permissions = await authorizationService.getAllUserPermissions(
        userId,
        org.id
      );

      const membership = await orgDb.findMembership(userId, org.id);
      const role = membership?.roleId
        ? await roleDb.findRoleById(membership.roleId)
        : null;

      // Determine role name
      let roleName = 'Member';
      if (org.ownerId === userId) {
        roleName = 'Owner';
      } else if (role) {
        roleName = role.name;
      }

      return {
        ...org,
        permissions,
        role: roleName,
      };
    })
  );

  return enriched;
};

const getOrganizationById = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return organization;
};

const getOrganizationBySlug = async (slug, userId) => {
  const organization = await orgDb.findOrganizationBySlug(slug);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organization.id);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return organization;
};

const updateOrganization = async (organizationId, userId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) throw new Error('Organization not found');
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can update this organization');
  }

const allowedFields = [
  'name', 'logo', 'logoPublicId', 'email', 'phone', 'address',
  'country', 'currency', 'timezone', 'auditLogRetention',
];

  const updateData = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }

  if (updateData.name && updateData.name !== organization.name) {
    updateData.slug = await generateSlug(updateData.name);
  }

  if (updateData.auditLogRetention !== undefined) {
    const n = Number(updateData.auditLogRetention);
    const allowed = [30, 45, 60, 90];
    if (!allowed.includes(n)) {
      throw new Error('Audit log retention must be one of: 30, 45, 60, 90 days');
    }
    updateData.auditLogRetention = n;
  }

  if (Object.keys(updateData).length === 0) return organization;

  const updated = await orgDb.updateOrganization(organizationId, updateData);

  await audit.log({
    organizationId: organization.id,
    userId,
    action: 'ORGANIZATION_UPDATED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      updatedFields: Object.keys(updateData),
      before: { name: organization.name, country: organization.country },
    },
  });

  return updated;
};

const archiveOrganization = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can archive this organization');
  }

  const archived = await orgDb.archiveOrganization(organizationId);

  // Audit log: Organization archived
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ORGANIZATION_ARCHIVED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      name: organization.name,
    },
  });

  return archived;
};

const getArchivedOrganizations = async (userId) => {
  return orgDb.findArchivedOrganizationsByUserId(userId);
};

const restoreOrganization = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can restore this organization');
  }

  return orgDb.restoreOrganization(organizationId);
};

const getOrganizationMembers = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // If user has all branches, return all members
  if (membership.hasAllBranches) {
    const members = await orgDb.findMembershipsByOrganization(organizationId);
    return members;
  }

  // Otherwise, get user's assigned branches
  const assignments = await prisma.branchAssignment.findMany({
    where: { membershipId: membership.id },
    select: { branchId: true },
  });
  const assignedBranchIds = assignments.map(a => a.branchId);

  if (assignedBranchIds.length === 0) {
    throw new Error('You do not have access to any branch');
  }

  // Get all members who have assignments to these branches
  // or have all branches access (owners/managers)
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { hasAllBranches: true },
        {
          branchAssignments: {
            some: {
              branchId: { in: assignedBranchIds },
            },
          },
        },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      role: true,
    },
    orderBy: { joinedAt: 'desc' },
  });

  return members;
};

const removeMember = async (organizationId, userId, memberId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // ---- Cannot remove yourself ----
  if (userId === memberId) {
    throw new Error(
      'Organization owner cannot remove themselves. Transfer ownership first.'
    );
  }

  // ---- Cannot remove the org owner ----
  // The owner's membership is tied to the org. Only a transfer-of-ownership
  // flow should change that, not a member-removal call.
  if (organization.ownerId === memberId) {
    throw new Error(
      'The organization owner cannot be removed. Transfer ownership first.'
    );
  }

  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  // ---- Escalation guard ----
  // If the caller is not the org owner, they cannot remove a member whose
  // role has permissions the caller does not have. This prevents a manager
  // with `members.manage` from kicking out another manager or higher.
  const isOwner = organization.ownerId === userId;
  if (!isOwner) {
    const callerPerms = new Set(
      await authorizationService.getAllUserPermissions(userId, organizationId)
    );

    if (membership.roleId) {
      const targetRole = await roleDb.findRoleById(membership.roleId);
      if (targetRole) {
        const targetKeys = (targetRole.permissions ?? []).map((rp) =>
          rp.permission ? rp.permission.key : rp.key
        );

        // Wildcard target → admin-tier, only owner can remove
        if (targetKeys.includes('*')) {
          throw new Error(
            'You do not have permission to remove this member'
          );
        }

        // Any target permission the caller lacks → blocked
        const hasEscalation = targetKeys.some((k) => !callerPerms.has(k));
        if (hasEscalation) {
          throw new Error(
            'You do not have permission to remove this member'
          );
        }
      }
    }
  }

  await orgDb.deleteMembership(membership.id);

  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'MEMBER_REMOVED',
    resource: 'membership',
    resourceId: membership.id,
    metadata: {
      removedUserId: memberId,
      removedRoleId: membership.roleId,
    },
  });

  return { message: 'Member removed successfully' };
};

export default {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  archiveOrganization,
  getArchivedOrganizations,  
  restoreOrganization,
  getOrganizationMembers,
  removeMember,
};