// src/modules/platform/admin/routes/cleanup.routes.js

import express from 'express';
import { cleanupTestOrgs } from '../controllers/cleanup.controller.js';

const router = express.Router();

// ⚠️ TEMPORARY — Remove after testing
router.delete('/test-orgs', cleanupTestOrgs);

export default router;