// src/modules/products/kxtill/mobile/controllers/branches.controller.js

import { ok } from '../common/envelope.js';
import {
  composeBranches,
  composeBranchDetail,
  composeBranchSales,
  composeBranchStock,
  composeBranchShifts,
  reviewShiftVariance,
  forceCloseShift,
} from '../services/branches.service.js';



export async function getBranches(req, res) {
  try {
    const ctx = req.mobileContext;

    // Require the base permission to list branches at all.
    if (!(await ctx.can('branches.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view branches',
      });
    }

    const period = typeof req.query.period === 'string' ? req.query.period : 'today';
    const data = await composeBranches(ctx, { period });

    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/branches]', e);
    res.status(500).json({
      code: 'BRANCHES_FAILED',
      message: 'Could not load branches',
    });
  }
}

export async function getBranchDetail(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('branches.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view branches',
      });
    }
    const { branchId } = req.params;
    const period =
      typeof req.query.period === 'string' ? req.query.period : 'today';
    const data = await composeBranchDetail(ctx, branchId, { period });
    if (data.notFound) {
      return res.status(404).json({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or not accessible',
      });
    }
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/branch-detail]', e);
    res.status(500).json({
      code: 'BRANCH_DETAIL_FAILED',
      message: 'Could not load branch',
    });
  }
}

export async function getBranchSales(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('branches.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view branches',
      });
    }
    const { branchId } = req.params;
    const period =
      typeof req.query.period === 'string' ? req.query.period : 'today';
    const data = await composeBranchSales(ctx, branchId, { period });
    if (data.forbidden) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view sales',
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
    console.error('[mobile/branch-sales]', e);
    res.status(500).json({
      code: 'BRANCH_SALES_FAILED',
      message: 'Could not load sales',
    });
  }
}

export async function getBranchStock(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('branches.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view branches',
      });
    }
    const { branchId } = req.params;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await composeBranchStock(ctx, branchId, { status });
    if (data.forbidden) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view inventory',
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
    console.error('[mobile/branch-stock]', e);
    res.status(500).json({
      code: 'BRANCH_STOCK_FAILED',
      message: 'Could not load stock',
    });
  }
}

export async function getBranchShifts(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('branches.view'))) {
      return res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'You do not have permission to view branches' });
    }
    const { branchId } = req.params;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await composeBranchShifts(ctx, branchId, { status });
    if (data.forbidden) {
      return res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'You do not have permission to view shifts' });
    }
    if (data.notFound) {
      return res
        .status(404)
        .json({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found or not accessible' });
    }
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/branch-shifts]', e);
    res.status(500).json({
      code: 'BRANCH_SHIFTS_FAILED',
      message: 'Could not load shifts',
    });
  }
}

export async function postReviewShift(req, res) {
  try {
    const ctx = req.mobileContext;
    const { branchId, shiftId } = req.params;
    const { note } = req.body || {};
    const result = await reviewShiftVariance(ctx, branchId, shiftId, note);
    if (result.forbidden) {
      return res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'You do not have permission to review variance' });
    }
    if (result.notFound) {
      return res
        .status(404)
        .json({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found for this branch' });
    }
    res.json(ok({ shift: result.shift }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/review-shift]', e);
    res.status(500).json({
      code: 'REVIEW_FAILED',
      message: e?.message || 'Could not review shift',
    });
  }
}

export async function postForceCloseShift(req, res) {
  try {
    const ctx = req.mobileContext;
    const { branchId, shiftId } = req.params;
    const { declaredCash, reason } = req.body || {};
    if (declaredCash == null || Number.isNaN(Number(declaredCash))) {
      return res
        .status(400)
        .json({ code: 'INVALID_INPUT', message: 'declaredCash is required' });
    }
    const result = await forceCloseShift(
      ctx,
      branchId,
      shiftId,
      Number(declaredCash),
      reason
    );
    if (result.forbidden) {
      return res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'You do not have permission to force close shifts' });
    }
    if (result.notFound) {
      return res
        .status(404)
        .json({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found for this branch' });
    }
    res.json(ok({ shift: result.shift }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/force-close-shift]', e);
    res.status(500).json({
      code: 'FORCE_CLOSE_FAILED',
      message: e?.message || 'Could not force close shift',
    });
  }
}

export default {
  getBranches,
  getBranchDetail,
  getBranchSales,
  getBranchStock,
  getBranchShifts,
  postReviewShift,
  postForceCloseShift,
};