// src/modules/platform/organizations/services/invitation.service.js

import crypto from 'crypto';
import invitationDb from '../db/invitation.db.js';
import orgDb from '../db/org.db.js';
import { sendInvitationEmail } from '../../identity/email/email.service.js';

const INVITATION_EXPIRY_DAYS = 7;

const sendInvitation = async (inviterId, organizationId, email, roleId = null) => {
  // Check if organization exists
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Check if inviter is owner
  if (organization.ownerId !== inviterId) {
    throw new Error('Only the organization owner can send invitations');
  }

  // Check for existing pending invitation
  const pending = await invitationDb.findPendingInvitation(email, organizationId);
  if (pending) {
    throw new Error('An invitation is already pending for this email');
  }

  // Check if user is already a member (by email lookup)
  // We'll handle this in the controller with user lookup

  // Generate token
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

  // Get inviter name
  const inviter = await orgDb.findUserById(inviterId);
  const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Someone';

  // Send email
  await sendInvitationEmail(email, token, organization.name, inviterName);

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

  // Check if user already has membership
  const existingMembership = await orgDb.findMembership(userId, invitation.organizationId);
  if (existingMembership) {
    throw new Error('You are already a member of this organization');
  }

  // Create membership
  const membership = await orgDb.createMembership({
    userId,
    organizationId: invitation.organizationId,
    roleId: invitation.roleId,
    isActive: true,
  });

  // Update invitation status
  await invitationDb.updateInvitationStatus(invitation.id, 'ACCEPTED', new Date());

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