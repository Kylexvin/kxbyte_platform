// src/modules/platform/organizations/services/invitation.service.js

import crypto from 'crypto';
import invitationDb from '../db/invitation.db.js';
import orgDb from '../db/org.db.js';
import branchDb from '../../branches/db/branch.db.js';
import { sendInvitationEmail } from '../../identity/email/email.service.js';
import audit from '../../audit/index.js';

const INVITATION_EXPIRY_DAYS = 7;

// ============================================================
// SEND INVITATION
// ============================================================

const sendInvitation = async (
  inviterId,
  organizationId,
  email,
  roleId = null,
  branchIds = []
) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const pending = await invitationDb.findPendingInvitation(email, organizationId);
  if (pending) {
    throw new Error('An invitation is already pending for this email');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const invitation = await invitationDb.createInvitation({
    email,
    organizationId,
    invitedById: inviterId,
    roleId,
    branchIds,
    token,
    expiresAt,
  });

  const inviter = await orgDb.findUserById(inviterId);
  const inviterName = inviter
    ? `${inviter.firstName} ${inviter.lastName}`
    : 'Someone';

  await sendInvitationEmail(email, token, organization.name, inviterName);

  await audit.log({
    organizationId: organization.id,
    userId: inviterId,
    action: 'INVITATION_SENT',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: { email, roleId, branchIds, expiresAt },
  });

  return invitation;
};

// ============================================================
// ACCEPT INVITATION
// ============================================================

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

  const existingMembership = await orgDb.findMembership(
    userId,
    invitation.organizationId
  );
  if (existingMembership) {
    throw new Error('You are already a member of this organization');
  }

  const membership = await orgDb.createMembership({
    userId,
    organizationId: invitation.organizationId,
    roleId: invitation.roleId,
    isActive: true,
  });

  // Attach branches carried by the invitation. Non-fatal if a
  // single branchId fails — the invitee still ends up as a member.
  for (const branchId of invitation.branchIds ?? []) {
    try {
      await branchDb.assignBranchToMembership(membership.id, branchId);
    } catch (err) {
      console.error(`Failed to assign branch ${branchId} on accept:`, err);
    }
  }

  await invitationDb.updateInvitationStatus(
    invitation.id,
    'ACCEPTED',
    new Date()
  );

  await audit.log({
    organizationId: invitation.organizationId,
    userId,
    action: 'INVITATION_ACCEPTED',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: {
      email: invitation.email,
      roleId: invitation.roleId,
      branchIds: invitation.branchIds ?? [],
    },
  });

  return {
    membership,
    organization: invitation.organization,
  };
};

// ============================================================
// REJECT INVITATION
// ============================================================

const rejectInvitation = async (token) => {
  const invitation = await invitationDb.findInvitationByToken(token);
  if (!invitation) {
    throw new Error('Invalid invitation');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
  }

  await invitationDb.updateInvitationStatus(invitation.id, 'REJECTED');

  await audit.log({
    organizationId: invitation.organizationId,
    userId: invitation.invitedById,
    action: 'INVITATION_REJECTED',
    resource: 'invitation',
    resourceId: invitation.id,
    metadata: { email: invitation.email },
  });

  return { message: 'Invitation rejected' };
};

// ============================================================
// GET ORGANIZATION INVITATIONS
// ============================================================

const getOrganizationInvitations = async (organizationId, status = null) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const invitations = await invitationDb.findInvitationsByOrganization(
    organizationId
  );

  if (!status) return invitations;

  return invitations.filter((inv) => inv.status === status);
};

// ============================================================
// GET USER INVITATIONS
// ============================================================

const getUserInvitations = async (email) => {
  return invitationDb.findInvitationsByEmail(email);
};

// ============================================================
// RESEND INVITATION
// ============================================================

const resendInvitation = async (invitationId, organizationId, userId) => {
  const invitation = await invitationDb.findInvitationById(invitationId);

  if (!invitation || invitation.organizationId !== organizationId) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Only pending invitations can be resent');
  }

  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const updated = await invitationDb.updateInvitation(invitationId, {
    token: newToken,
    expiresAt: newExpiresAt,
  });

  const organization = await orgDb.findOrganizationById(organizationId);
  const inviter = await orgDb.findUserById(userId);
  const inviterName = inviter
    ? `${inviter.firstName} ${inviter.lastName}`
    : 'Someone';

  await sendInvitationEmail(
    updated.email,
    newToken,
    organization?.name ?? 'the organization',
    inviterName
  );

  await audit.log({
    organizationId,
    userId,
    action: 'INVITATION_RESENT',
    resource: 'invitation',
    resourceId: invitationId,
    metadata: { email: updated.email, newExpiresAt },
  });

  return updated;
};

// ============================================================
// REVOKE INVITATION
// ============================================================

const revokeInvitation = async (invitationId, organizationId, userId) => {
  const invitation = await invitationDb.findInvitationById(invitationId);

  if (!invitation || invitation.organizationId !== organizationId) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Only pending invitations can be revoked');
  }

  const updated = await invitationDb.updateInvitationStatus(
    invitationId,
    'REJECTED'
  );

  await audit.log({
    organizationId,
    userId,
    action: 'INVITATION_REVOKED',
    resource: 'invitation',
    resourceId: invitationId,
    metadata: { email: invitation.email, reason: 'revoked_by_owner' },
  });

  return { message: 'Invitation revoked', invitation: updated };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  getOrganizationInvitations,
  getUserInvitations,
  resendInvitation,
  revokeInvitation,
};