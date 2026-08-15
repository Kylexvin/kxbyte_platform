// src/modules/platform/organizations/routes/org.routes.js

import express from 'express';
import orgController from '../controllers/org.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware.authenticate);

router.post('/', orgController.createOrganization);
router.get('/', orgController.getOrganizations);

// ✅ Move this BEFORE /:id
router.get('/archived', orgController.getArchivedOrganizations);

router.get('/:id', orgController.getOrganization);
router.patch('/:id', orgController.updateOrganization);
router.delete('/:id', orgController.archiveOrganization);

router.patch('/:organizationId/restore', orgController.restoreOrganization);
router.get('/:id/members', orgController.getMembers);
router.delete('/:id/members/:memberId', orgController.removeMember);
router.patch('/:id/members/:memberId/role', orgController.updateMemberRole);

export default router;