// src/modules/platform/organizations/db/org.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// ORGANIZATION OPERATIONS
// ============================================================

const createOrganization = async (data) => {
  return prisma.organization.create({ data });
};

const findOrganizationById = async (id) => {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
};

const findOrganizationBySlug = async (slug) => {
  return prisma.organization.findUnique({
    where: { slug },
  });
};

const findOrganizationsByUserId = async (userId) => {
  return prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          userId,
          isActive: true,
        },
      },
      isActive: true,
      isArchived: false,
    },
    orderBy: { createdAt: 'desc' },
  });
};

const updateOrganization = async (id, data) => {
  return prisma.organization.update({
    where: { id },
    data,
  });
};

const archiveOrganization = async (id) => {
  return prisma.organization.update({
    where: { id },
    data: { isArchived: true, isActive: false },
  });
};

const restoreOrganization = async (id) => {
  return prisma.organization.update({
    where: { id },
    data: { isArchived: false, isActive: true },
  });
};

const findArchivedOrganizationsByUserId = async (userId) => {
  return prisma.organization.findMany({
    where: {
      ownerId: userId,
      isArchived: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
};

// ============================================================
// MEMBERSHIP OPERATIONS
// ============================================================

const createMembership = async (data) => {
  return prisma.membership.create({ data });
};

const findMembership = async (userId, organizationId) => {
  return prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
};

const findActiveMembershipWithOrg = async (userId, organizationId) => {
  return prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      organization: {
        where: {
          isActive: true,
          isArchived: false,
        },
      },
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });
};

const findMembershipsByOrganization = async (organizationId) => {
  return prisma.membership.findMany({
    where: { organizationId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

const findMembershipsByUser = async (userId) => {
  return prisma.membership.findMany({
    where: { userId, isActive: true },
    include: {
      organization: true,
    },
  });
};

const updateMembership = async (id, data) => {
  return prisma.membership.update({
    where: { id },
    data,
  });
};

const deleteMembership = async (id) => {
  return prisma.membership.delete({ where: { id } });
};

// ============================================================
// USER LOOKUP
// ============================================================

const findUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
};

const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
};

// ============================================================
// BRANCH OPERATIONS
// ============================================================

const findActiveBranch = async (branchId, organizationId) => {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
      isActive: true,
      deletedAt: null,
    },
  });
};

const findBranchAccess = async (userId, branchId) => {
  return prisma.branchAccess.findFirst({
    where: {
      userId,
      branchId,
      isActive: true,
    },
  });
};

// ============================================================
// PERMISSION OPERATIONS
// ============================================================

const hasPermission = async (userId, organizationId, permission) => {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership) return false;

  if (membership.role?.name === 'OWNER') return true;

  return membership.role?.permissions?.some((p) => p.name === permission) || false;
};

const getUserRole = async (userId, organizationId) => {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
    },
    include: {
      role: true,
    },
  });

  return membership?.role?.name || null;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Organization
  createOrganization,
  findOrganizationById,
  findOrganizationBySlug,
  findOrganizationsByUserId,
  updateOrganization,
  archiveOrganization,
  restoreOrganization,
  findArchivedOrganizationsByUserId,

  // Membership
  createMembership,
  findMembership,
  findActiveMembershipWithOrg,
  findMembershipsByOrganization,
  findMembershipsByUser,
  updateMembership,
  deleteMembership,

  // User
  findUserById,
  findUserByEmail,

  // Branch
  findActiveBranch,
  findBranchAccess,

  // Permission
  hasPermission,
  getUserRole,
};