// src/modules/products/kxtill/mobile/controllers/favorites.controller.js

import { ok } from '../common/envelope.js';
import favoritesService from '../services/favorites.service.js';

export async function list(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('kxtill.inventory.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view products',
      });
    }
    const { branchId } = req.params;
    const items = await favoritesService.listFavorites(ctx, branchId);
    res.json(ok({ items }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/favorites/list]', e);
    res.status(500).json({
      code: 'FAVORITES_FAILED',
      message: 'Could not load favorites',
    });
  }
}

export async function toggle(req, res) {
  try {
    const ctx = req.mobileContext;
    if (!(await ctx.can('kxtill.inventory.view'))) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify favorites',
      });
    }
    const { branchId } = req.params;
    const { productId } = req.body || {};
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PAYLOAD',
        message: 'productId is required',
      });
    }
    const data = await favoritesService.toggleFavorite(ctx, branchId, productId);
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    const status = e?.status || 500;
    res.status(status).json({
      code: e?.code || 'FAVORITE_TOGGLE_FAILED',
      message: e?.message || 'Could not update favorite',
    });
  }
}

export default {
  list,
  toggle,
};