// src/modules/products/kxtill/mobile/controllers/team.controller.js

import { ok } from '../common/envelope.js';
import { composeBranchTeam } from '../services/team.service.js';

export async function getBranchTeam(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('branches.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view branches',
      });
    }
    const { branchId } = req.params;
    const data = await composeBranchTeam(ctx, branchId);
    if (data.forbidden) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view team',
      });
    }
    if (data.notFound) {
      return res.status(404).json({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or not accessible',
      });
    }
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/branch-team]', e);
    res.status(500).json({
      code: 'BRANCH_TEAM_FAILED',
      message: 'Could not load team',
    });
  }
}

export default { getBranchTeam };