// src/modules/products/kxtill/mobile/controllers/devices.controller.js

import deviceTokenService from '../../../../platform/notifications/services/deviceToken.service.js';
import { ok } from '../common/envelope.js';

export async function register(req, res) {
  try {
    const userId = req.mobileContext?.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }
    const { token, platform, deviceLabel } = req.body || {};
    const saved = await deviceTokenService.register(userId, 'kxtill', {
      token,
      platform,
      deviceLabel,
    });
    res.json(ok({ id: saved.id }, { source: 'live' }));
  } catch (e) {
    const status = e.status || 500;
    res
      .status(status)
      .json({ code: e.code || 'REGISTER_FAILED', message: e.message });
  }
}

export async function unregister(req, res) {
  try {
    const userId = req.mobileContext?.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }
    const { token } = req.params;
    await deviceTokenService.unregister(token);
    res.json(ok({ removed: true }, { source: 'live' }));
  } catch (e) {
    const status = e.status || 500;
    res
      .status(status)
      .json({ code: e.code || 'UNREGISTER_FAILED', message: e.message });
  }
}

export default { register, unregister };