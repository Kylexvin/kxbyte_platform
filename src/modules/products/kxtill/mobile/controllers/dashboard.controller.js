// src/modules/products/kxtill/mobile/controllers/dashboard.controller.js

import { ok } from '../common/envelope.js';
import { composeDashboard } from '../services/dashboard.service.js';

export async function getDashboard(req, res) {
  try {
    const ctx = req.mobileContext;
    const data = await composeDashboard(ctx);
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/dashboard]', e);
    res.status(500).json({
      code: 'DASHBOARD_FAILED',
      message: 'Could not build dashboard',
    });
  }
}

export default { getDashboard };