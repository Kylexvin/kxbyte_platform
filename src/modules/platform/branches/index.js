// src/modules/platform/branches/index.js

import branchRoutes from './routes/branch.routes.js';
import branchService from './services/branch.service.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/branches', branchRoutes);
};

export default {
  register,
  // Service exports for other modules
  createBranch: branchService.createBranch,
  getBranches: branchService.getBranches,
  getBranch: branchService.getBranch,
  updateBranch: branchService.updateBranch,
  deleteBranch: branchService.deleteBranch,
  assignBranchToMember: branchService.assignBranchToMember,
  removeBranchFromMember: branchService.removeBranchFromMember,
  getMemberBranches: branchService.getMemberBranches,
  hasBranchAccess: branchService.hasBranchAccess,
  getUserBranches: branchService.getUserBranches,
};