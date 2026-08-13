// src/modules/platform/organizations/db/org.db.js

import prisma from '../../../../database/postgres/prisma.js';

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
      isArchived: false, // ✅ Exclude archived orgs
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

const deleteMembership = async (id) => {
  return prisma.membership.delete({ where: { id } });
};

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

const updateMembership = async (id, data) => {
  return prisma.membership.update({
    where: { id },
    data,
  });
};

export default {
  createOrganization,
  findOrganizationById,
  findOrganizationBySlug,
  findOrganizationsByUserId,
  updateOrganization,
  archiveOrganization,
  createMembership,
  findMembership,
  findMembershipsByOrganization,
  findMembershipsByUser,
  deleteMembership,
  findUserById,
  findUserByEmail,
  updateMembership,
};