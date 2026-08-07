// src/modules/platform/organizations/db/invitation.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createInvitation = async (data) => {
  return prisma.invitation.create({ data });
};

const findInvitationByToken = async (token) => {
  return prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: true,
      invitedBy: {
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

const findPendingInvitation = async (email, organizationId) => {
  return prisma.invitation.findFirst({
    where: {
      email,
      organizationId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });
};

const findInvitationsByOrganization = async (organizationId) => {
  return prisma.invitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      invitedBy: {
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

const findInvitationsByEmail = async (email) => {
  return prisma.invitation.findMany({
    where: { email },
    orderBy: { createdAt: 'desc' },
    include: {
      organization: true,
      invitedBy: {
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

const updateInvitationStatus = async (id, status, acceptedAt = null) => {
  return prisma.invitation.update({
    where: { id },
    data: { status, acceptedAt },
  });
};

const updateInvitation = async (id, data) => {
  return prisma.invitation.update({
    where: { id },
    data,
  });
};

export default {
  createInvitation,
  findInvitationByToken,
  findPendingInvitation,
  findInvitationsByOrganization,
  findInvitationsByEmail,
  updateInvitationStatus,
  updateInvitation,
};