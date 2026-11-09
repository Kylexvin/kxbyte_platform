// src/modules/products/kxtill/mobile/controllers/sales-summary.controller.js

import { ok } from '../common/envelope.js';
import salesSummaryService from '../services/sales-summary.service.js';

export async function getRecent(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('kxtill.inventory.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view products',
      });
    }
    const { branchId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const items = await salesSummaryService.getRecentProducts(
      ctx.organizationId,
      branchId,
      limit
    );
    res.json(ok({ items }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/sales-summary/recent]', e);
    res.status(500).json({
      code: 'RECENT_PRODUCTS_FAILED',
      message: 'Could not load recent products',
    });
  }
}

export async function getTop(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('kxtill.inventory.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view products',
      });
    }
    const { branchId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    const items = await salesSummaryService.getTopProducts(
      ctx.organizationId,
      branchId,
      limit,
      days
    );
    res.json(ok({ items }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/sales-summary/top]', e);
    res.status(500).json({
      code: 'TOP_PRODUCTS_FAILED',
      message: 'Could not load top products',
    });
  }
}

export default {
  getRecent,
  getTop,
};