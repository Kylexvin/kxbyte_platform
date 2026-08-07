// src/modules/platform/organizations/index.js

import orgRoutes from './routes/org.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import invitationController from './controllers/invitation.controller.js';
import authMiddleware from '../identity/middleware/auth.middleware.js';
import orgService from './services/org.service.js';
import invitationService from './services/invitation.service.js';

const register = (app) => {
  app.use('/api/v1/organizations', orgRoutes);
  app.use('/api/v1/organizations/:organizationId/invitations', invitationRoutes);
  
  // User-level invitation routes (not scoped to organization)
  app.get('/api/v1/invitations/my', authMiddleware.authenticate, invitationController.getUserInvitations);
  app.post('/api/v1/invitations/accept', authMiddleware.authenticate, invitationController.acceptInvitation);
  app.post('/api/v1/invitations/reject', authMiddleware.authenticate, invitationController.rejectInvitation);
};

export default {
  register,
  // Organization exports
  createOrganization: orgService.createOrganization,
  getOrganizations: orgService.getOrganizations,
  getOrganizationById: orgService.getOrganizationById,
  getOrganizationBySlug: orgService.getOrganizationBySlug,
  updateOrganization: orgService.updateOrganization,
  archiveOrganization: orgService.archiveOrganization,
  getOrganizationMembers: orgService.getOrganizationMembers,
  removeMember: orgService.removeMember,
  // Invitation exports
  sendInvitation: invitationService.sendInvitation,
  acceptInvitation: invitationService.acceptInvitation,
  rejectInvitation: invitationService.rejectInvitation,
  getOrganizationInvitations: invitationService.getOrganizationInvitations,
  getUserInvitations: invitationService.getUserInvitations,
};