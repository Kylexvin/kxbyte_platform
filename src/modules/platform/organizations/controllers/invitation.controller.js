// src/modules/platform/organizations/controllers/invitation.controller.js

import invitationService from '../services/invitation.service.js';
import invitationValidator from '../validators/invitation.validator.js';
import orgDb from '../db/org.db.js';
import invitationDb from '../db/invitation.db.js';

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
    const { email, roleId } = req.body;

    // Normalize email
    const normalizedEmail = email.toLowerCase();

    // Check if trying to invite yourself
    const currentUser = await orgDb.findUserById(userId);
    if (currentUser && currentUser.email.toLowerCase() === normalizedEmail) {
      return res.status(400).json({ error: 'You cannot invite yourself' });
    }

    // Check if user is already a member
    const existingUser = await orgDb.findUserByEmail(normalizedEmail);
    if (existingUser) {
      const membership = await orgDb.findMembership(existingUser.id, organizationId);
      if (membership) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }
    }

    const invitation = await invitationService.sendInvitation(
      userId,
      organizationId,
      normalizedEmail,
      roleId
    );

    res.status(201).json({ invitation });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can send invitations') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'An invitation is already pending for this email') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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

    // Get user and invitation to verify email match
    const user = await orgDb.findUserById(userId);
    const invitation = await invitationDb.findInvitationByToken(token);
    
    if (!invitation) {
      return res.status(400).json({ error: 'Invalid invitation' });
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' });
    }

    const result = await invitationService.acceptInvitation(token, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Invalid invitation' ||
        error.message === 'Invitation has expired' ||
        error.message === 'You are already a member of this organization') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Invitation is already accepted' ||
        error.message === 'Invitation is already rejected' ||
        error.message === 'Invitation is already expired') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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
    if (error.message === 'Invalid invitation' ||
        error.message === 'Invitation is already accepted' ||
        error.message === 'Invitation is already rejected' ||
        error.message === 'Invitation is already expired') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrganizationInvitations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const invitations = await invitationService.getOrganizationInvitations(organizationId, userId);
    res.status(200).json({ invitations });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can view invitations') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get organization invitations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserInvitations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user email from authenticated user
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

export default {
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  getOrganizationInvitations,
  getUserInvitations,
};