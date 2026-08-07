// src/modules/platform/authorization/routes/role.routes.js

import express from 'express';
import roleController from '../controllers/role.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authMiddleware.authenticate);

// Role CRUD
router.post('/', roleController.createRole);
router.get('/', roleController.getRoles);
router.get('/:roleId', roleController.getRole);
router.patch('/:roleId', roleController.updateRole);
router.delete('/:roleId', roleController.deleteRole);

// Role permissions
router.post('/:roleId/permissions', roleController.addPermissionToRole);
router.delete('/:roleId/permissions/:permissionId', roleController.removePermissionFromRole);

// Member role assignment (organization level)
router.patch('/members/:memberId/role', roleController.assignRoleToMember);

export default router;