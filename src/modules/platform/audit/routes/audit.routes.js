// src/modules/platform/audit/routes/audit.routes.js

import express from 'express';
import auditController from '../controllers/audit.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// Audit log routes
router.get('/', auditController.getAuditEvents);
router.get('/stats', auditController.getAuditStats);
router.get('/export', auditController.exportAuditLogs);
router.get('/', auditController.getAuditEvents);
router.get('/:eventId', auditController.getAuditEvent);

export default router;