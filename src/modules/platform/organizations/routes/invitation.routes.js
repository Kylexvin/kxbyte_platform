// src/modules/platform/organizations/routes/invitation.routes.js

import express from 'express';
import invitationController from '../controllers/invitation.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// ============================================================
// ORGANIZATION INVITATIONS
// ============================================================

// List all invitations for the organization
// GET /api/v1/organizations/:organizationId/invitations?status=PENDING
router.get('/', invitationController.getOrganizationInvitations);

// Send a new invitation
// POST /api/v1/organizations/:organizationId/invitations
router.post('/', invitationController.sendInvitation);

// ============================================================
// INVITE-TIME ACTIONS (accept / reject)
// ============================================================

router.post('/accept', invitationController.acceptInvitation);
router.post('/reject', invitationController.rejectInvitation);

// ============================================================
// PER-INVITATION ACTIONS
// ============================================================

// Resend a pending invitation (regenerates token + extends expiry)
// POST /api/v1/organizations/:organizationId/invitations/:invitationId/resend
router.post('/:invitationId/resend', invitationController.resendInvitation);

// Revoke a pending invitation
// DELETE /api/v1/organizations/:organizationId/invitations/:invitationId
router.delete('/:invitationId', invitationController.revokeInvitation);

// ============================================================
// USER-SIDE INVITATIONS (invitee's own list)
// ============================================================

// GET /api/v1/organizations/invitations/my  (or wherever the parent mounts this)
router.get('/my', invitationController.getUserInvitations);

export default router;