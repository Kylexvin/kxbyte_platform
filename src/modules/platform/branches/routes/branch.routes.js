// src/modules/platform/branches/routes/branch.routes.js

import express from 'express';
import branchController from '../controllers/branch.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';
import branchActivityController from '../controllers/branch-activity.controller.js';



const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// User's own accessible branches
router.get('/my', branchController.getMyBranches);

// Branch CRUD
router.post('/', branchController.createBranch);
router.get('/', branchController.getBranches);
router.get('/activity', branchActivityController.getBranchActivity);
router.get('/:branchId', branchController.getBranch);
router.patch('/:branchId', branchController.updateBranch);
router.delete('/:branchId', branchController.deleteBranch);


// Branch assignments
router.post('/:branchId/assign', branchController.assignBranchToMember);
router.delete('/:branchId/assign', branchController.removeBranchFromMember);
router.get('/members/:memberId/branches', branchController.getMemberBranches);
router.get('/:branchId/members', branchController.getBranchMembers);

export default router;