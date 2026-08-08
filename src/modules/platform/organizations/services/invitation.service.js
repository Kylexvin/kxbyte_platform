// src/modules/platform/organizations/services/invitation.service.js

import crypto from 'crypto';
import invitationDb from '../db/invitation.db.js';
import orgDb from '../db/org.db.js';
import { sendInvitationEmail } from '../../identity/email/email.service.js';
import audit from '../../audit/index.js';

const INVITATION_EXPIRY_DAYS = 7;

const sendInvitation = async (inviterId, organizationId, email, roleId = null) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== inviterId) {
    throw new Error('Only the organization owner can send invitations');
  }

  const pending = await invitationDb.findPendingInvitation(email, organizationId);
  if (pending) {
    throw new Error('An invitation is already pending for this email');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await invitationDb.createInvitation({
    email,
    organizationId,
    invitedById: inviterId,
    roleId,
    token,
    expiresAt,
  });

  const inviter = await orgDb.findUserById(inviterId);
  const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone';

  await sendInvitationEmail(email, token, organization.name, inviterName);

  // Audit log: Invitation sent
  await audit.log({
    organizationId: organization.id,
    userId: inviterId,
    action: 'INVITATION_SENT',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: {
      email: email,
      roleId: roleId,
      expiresAt: expiresAt,
    },
  });

  return invitation;
};

const acceptInvitation = async (token, userId) => {
  const invitation = await invitationDb.findInvitationByToken(token);
  if (!invitation) {
    throw new Error('Invalid invitation');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
  }

  if (invitation.expiresAt < new Date()) {
    await invitationDb.updateInvitationStatus(invitation.id, 'EXPIRED');
    throw new Error('Invitation has expired');
  }

  const existingMembership = await orgDb.findMembership(userId, invitation.organizationId);
  if (existingMembership) {
    throw new Error('You are already a member of this organization');
  }

  const membership = await orgDb.createMembership({
    userId,
    organizationId: invitation.organizationId,
    roleId: invitation.roleId,
    isActive: true,
  });

  await invitationDb.updateInvitationStatus(invitation.id, 'ACCEPTED', new Date());

  // Audit log: Invitation accepted
  await audit.log({
    organizationId: invitation.organizationId,
    userId: userId,
    action: 'INVITATION_ACCEPTED',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: {
      email: invitation.email,
      roleId: invitation.roleId,
    },
  });

  return {
    membership,
    organization: invitation.organization,
  };
};

const rejectInvitation = async (token) => {
  const invitation = await invitationDb.findInvitationByToken(token);
  if (!invitation) {
    throw new Error('Invalid invitation');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
  }

  await invitationDb.updateInvitationStatus(invitation.id, 'REJECTED');

  // Audit log: Invitation rejected
  await audit.log({
    organizationId: invitation.organizationId,
    userId: invitation.invitedById,
    action: 'INVITATION_REJECTED',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: {
      email: invitation.email,
    },
  });

  return { message: 'Invitation rejected' };
};

const getOrganizationInvitations = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can view invitations');
  }

  const invitations = await invitationDb.findInvitationsByOrganization(organizationId);
  return invitations;
};

const getUserInvitations = async (email) => {
  const invitations = await invitationDb.findInvitationsByEmail(email);
  return invitations;
};

export default {
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  getOrganizationInvitations,
  getUserInvitations,
};