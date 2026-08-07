// src/modules/platform/organizations/routes/org.routes.js

import express from 'express';
import orgController from '../controllers/org.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

router.post('/', orgController.createOrganization);
router.get('/', orgController.getOrganizations);
router.get('/:id', orgController.getOrganization);
router.patch('/:id', orgController.updateOrganization);
router.delete('/:id', orgController.archiveOrganization);
router.get('/:id/members', orgController.getMembers);
router.delete('/:id/members/:memberId', orgController.removeMember);

export default router;