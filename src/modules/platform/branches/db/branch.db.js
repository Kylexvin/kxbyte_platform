// src/modules/platform/branches/db/branch.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// BRANCH CRUD
// ============================================================

const createBranch = async (data) => {
  return prisma.branch.create({ data });
};

const findBranchById = async (id, organizationId) => {
  return prisma.branch.findFirst({
    where: { id, organizationId },
    include: {
      assignments: {
        include: {
          membership: {
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
      },
    },
  });
};

const findBranchesByOrganization = async (organizationId, filters = {}) => {
  const { isActive, limit = 50, offset = 0 } = filters;
  const where = { organizationId };

  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      include: {
        assignments: {
          include: {
            membership: {
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
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      skip: offset,
      take: limit,
    }),
    prisma.branch.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const findDefaultBranch = async (organizationId) => {
  return prisma.branch.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
  });
};

const updateBranch = async (id, organizationId, data) => {
  return prisma.branch.update({
    where: { id },
    data,
  });
};

const deleteBranch = async (id, organizationId) => {
  return prisma.branch.update({
    where: { id },
    data: { isActive: false },
  });
};

// ============================================================
// BRANCH ASSIGNMENTS
// ============================================================

const assignBranchToMembership = async (membershipId, branchId) => {
  return prisma.branchAssignment.create({
    data: {
      membershipId,
      branchId,
    },
  });
};

const removeBranchAssignment = async (membershipId, branchId) => {
  return prisma.branchAssignment.delete({
    where: {
      membershipId_branchId: {
        membershipId,
        branchId,
      },
    },
  });
};

const findAssignmentsByMembership = async (membershipId) => {
  return prisma.branchAssignment.findMany({
    where: { membershipId },
    include: {
      branch: true,
    },
  });
};

const findAssignmentsByBranch = async (branchId) => {
  return prisma.branchAssignment.findMany({
    where: { branchId },
    include: {
      membership: {
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

const hasBranchAccess = async (membershipId, branchId) => {
  const assignment = await prisma.branchAssignment.findUnique({
    where: {
      membershipId_branchId: {
        membershipId,
        branchId,
      },
    },
  });
  return !!assignment;
};

export default {
  createBranch,
  findBranchById,
  findBranchesByOrganization,
  findDefaultBranch,
  updateBranch,
  deleteBranch,
  assignBranchToMembership,
  removeBranchAssignment,
  findAssignmentsByMembership,
  findAssignmentsByBranch,
  hasBranchAccess,
};