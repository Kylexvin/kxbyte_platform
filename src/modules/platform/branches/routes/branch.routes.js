// src/modules/platform/branches/routes/branch.routes.js

import express from 'express';
import branchController from '../controllers/branch.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Branch CRUD
router.post('/', branchController.createBranch);
router.get('/', branchController.getBranches);
router.get('/:branchId', branchController.getBranch);
router.patch('/:branchId', branchController.updateBranch);
router.delete('/:branchId', branchController.deleteBranch);

// Branch assignments
router.post('/:branchId/assign', branchController.assignBranchToMember);
router.delete('/:branchId/assign', branchController.removeBranchFromMember);
router.get('/members/:memberId/branches', branchController.getMemberBranches);

export default router;