// src/modules/platform/organizations/routes/invitation.routes.js

import express from 'express';
import invitationController from '../controllers/invitation.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// Organization invitations
router.post('/', invitationController.sendInvitation);
router.get('/', invitationController.getOrganizationInvitations);

// User's invitations
router.get('/my', invitationController.getUserInvitations);

// Accept/Reject
router.post('/accept', invitationController.acceptInvitation);
router.post('/reject', invitationController.rejectInvitation);

export default router;