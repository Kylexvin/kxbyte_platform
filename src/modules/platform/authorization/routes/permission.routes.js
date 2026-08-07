// src/modules/platform/authorization/routes/permission.routes.js

import express from 'express';
import permissionController from '../controllers/permission.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Permission listing
router.get('/', permissionController.listAllPermissions);
router.get('/product/:productKey', permissionController.listPermissionsByProduct);
router.get('/:key', permissionController.getPermissionByKey);

export default router;