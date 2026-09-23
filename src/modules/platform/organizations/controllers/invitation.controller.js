// src/modules/platform/organizations/controllers/invitation.controller.js

import invitationService from '../services/invitation.service.js';
import invitationValidator from '../validators/invitation.validator.js';
import orgDb from '../db/org.db.js';
import invitationDb from '../db/invitation.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import roleDb from '../../authorization/db/role.db.js';

// ============================================================
// PERMISSION HELPER
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// ESCALATION GUARDS
// ============================================================

/**
 * Prevents a non-owner from assigning the Owner role.
 * A role with the wildcard `*` permission is reserved for org owners.
 */
const isAdminRole = (role) => {
  if (!role) return false;
  if (role.name === 'Owner') return true;
  if (role.key === 'admin') return true;
  const perms = role.permissions ?? [];
  return perms.some((p) => {
    const key = p.permission ? p.permission.key : p.key;
    return key === '*';
  });
};

/**
 * Returns the flat permission key set of a role, regardless of shape
 * (Permission[] or RolePermission[] with nested permission).
 */
const flattenRolePermissionKeys = (role) => {
  if (!role) return [];
  const perms = role.permissions ?? [];
  return perms.map((p) => (p.permission ? p.permission.key : p.key));
};

/**
 * A non-owner inviter can only assign a role whose permissions are a
 * subset of their own. Owners bypass this entirely.
 */
const canAssignRole = (isOwner, inviterPerms, targetRole) => {
  if (isOwner) return true;
  if (isAdminRole(targetRole)) return false;
  const targetKeys = flattenRolePermissionKeys(targetRole);
  if (targetKeys.includes('*')) return false;
  return targetKeys.every((k) => inviterPerms.has(k));
};

// ============================================================
// SEND INVITATION
// ============================================================

const sendInvitation = async (req, res) => {
  const validation = invitationValidator.validateSendInvitation(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { email, roleId, branchIds } = req.body;

    // ---- Permission gate ----
    const hasPermission = await checkPermission(
      userId,
      organizationId,
      'members.manage'
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ error: 'You do not have permission to invite members' });
    }

    // ---- Normalize email ----
    const normalizedEmail = email.toLowerCase();

    // ---- Cannot invite self ----
    const currentUser = await orgDb.findUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (currentUser.email.toLowerCase() === normalizedEmail) {
      return res.status(400).json({ error: 'You cannot invite yourself' });
    }

    // ---- Already a member? ----
    const existingUser = await orgDb.findUserByEmail(normalizedEmail);
    if (existingUser) {
      const membership = await orgDb.findMembership(
        existingUser.id,
        organizationId
      );
      if (membership) {
        return res
          .status(400)
          .json({ error: 'User is already a member of this organization' });
      }
    }

    // ---- Escalation guard: role assignment ----
    if (roleId) {
      const organization = await orgDb.findOrganizationById(organizationId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const isOwner = organization.ownerId === userId;

      const targetRole = await roleDb.findRoleById(roleId);
      if (!targetRole) {
        return res.status(400).json({ error: 'Role not found' });
      }

      // Ensure the role belongs to this organization
      if (targetRole.organizationId !== organizationId) {
        return res
          .status(400)
          .json({ error: 'Role does not belong to this organization' });
      }

      // Non-owners cannot assign admin or escalate
      if (!isOwner) {
        // Gather inviter's effective permissions
        const inviterPerms = new Set(
          await authorizationService.getEffectivePermissions(
            userId,
            organizationId
          )
        );

        if (!canAssignRole(false, inviterPerms, targetRole)) {
          return res.status(403).json({
            error:
              'You cannot assign a role with more permissions than your own',
          });
        }
      }
    }

const invitation = await invitationService.sendInvitation(
  userId,
  organizationId,
  normalizedEmail,
  roleId,
  Array.isArray(branchIds) ? branchIds : []
);

    res.status(201).json({ invitation });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'An invitation is already pending for this email') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// ACCEPT INVITATION (invitee-side, no org permission required)
// ============================================================

const acceptInvitation = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token } = req.body;

    const validation = invitationValidator.validateAcceptInvitation({ token });
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const user = await orgDb.findUserById(userId);
    const invitation = await invitationDb.findInvitationByToken(token);

    if (!invitation) {
      return res.status(400).json({ error: 'Invalid invitation' });
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res
        .status(403)
        .json({ error: 'This invitation was sent to a different email address' });
    }

    const result = await invitationService.acceptInvitation(token, userId);
    res.status(200).json(result);
  } catch (error) {
    if (
      error.message === 'Invalid invitation' ||
      error.message === 'Invitation has expired' ||
      error.message === 'You are already a member of this organization'
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (
      error.message === 'Invitation is already accepted' ||
      error.message === 'Invitation is already rejected' ||
      error.message === 'Invitation is already expired'
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// REJECT INVITATION (invitee-side)
// ============================================================

const rejectInvitation = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token } = req.body;

    const validation = invitationValidator.validateRejectInvitation({ token });
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const result = await invitationService.rejectInvitation(token);
    res.status(200).json(result);
  } catch (error) {
    if (
      error.message === 'Invalid invitation' ||
      error.message === 'Invitation is already accepted' ||
      error.message === 'Invitation is already rejected' ||
      error.message === 'Invitation is already expired'
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// GET ORGANIZATION INVITATIONS
// ============================================================

const getOrganizationInvitations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { status } = req.query;

    // ---- Permission gate ----
    const hasPermission = await checkPermission(
      userId,
      organizationId,
      'members.view'
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ error: 'You do not have permission to view invitations' });
    }

const invitations = await invitationService.getOrganizationInvitations(
  organizationId,
  status || null
);

    res.status(200).json({ invitations });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get organization invitations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// GET USER'S OWN INVITATIONS
// ============================================================

const getUserInvitations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await orgDb.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const invitations = await invitationService.getUserInvitations(user.email);
    res.status(200).json({ invitations });
  } catch (error) {
    console.error('Get user invitations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// RESEND INVITATION
// ============================================================

const resendInvitation = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, invitationId } = req.params;

    // ---- Permission gate ----
    const hasPermission = await checkPermission(
      userId,
      organizationId,
      'members.manage'
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ error: 'You do not have permission to resend invitations' });
    }

    const invitation = await invitationService.resendInvitation(
      invitationId,
      organizationId,
      userId
    );

    res.status(200).json({ invitation });
  } catch (error) {
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only pending invitations can be resent') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Resend invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// REVOKE INVITATION
// ============================================================

const revokeInvitation = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, invitationId } = req.params;

    // ---- Permission gate ----
    const hasPermission = await checkPermission(
      userId,
      organizationId,
      'members.manage'
    );
    if (!hasPermission) {
      return res
        .status(403)
        .json({ error: 'You do not have permission to revoke invitations' });
    }

    const result = await invitationService.revokeInvitation(
      invitationId,
      organizationId,
      userId
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only pending invitations can be revoked') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  getOrganizationInvitations,
  getUserInvitations,
  resendInvitation,
  revokeInvitation,
};