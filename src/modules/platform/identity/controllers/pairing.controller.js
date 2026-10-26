// src/modules/platform/identity/controllers/pairing.controller.js

import pairingService from '../services/pairing.service.js';

const mapError = (res, error, fallback) => {
  const status = error.status || 500;
  const message = error.message || fallback || 'Something went wrong';
  if (status >= 500) console.error('[pairing]', error);
  return res.status(status).json({ code: error.code || 'PAIRING_ERROR', message });
};

export async function createSession(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });

    const { organizationId, branchId, deviceLabel } = req.body || {};
    const result = await pairingService.create(userId, {
      organizationId,
      branchId,
      deviceLabel,
    });
    return res.status(201).json(result);
  } catch (e) {
    return mapError(res, e, 'Failed to create pairing session');
  }
}

export async function redeemSession(req, res) {
  try {
    const { token, deviceLabel } = req.body || {};
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      null;

    const result = await pairingService.redeem(token, {
      deviceLabel,
      userAgent,
      ipAddress,
    });
    return res.json(result);
  } catch (e) {
    return mapError(res, e, 'Failed to redeem pairing code');
  }
}

export async function revokeSession(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    const { pairingId } = req.params;
    const result = await pairingService.revoke(userId, pairingId);
    return res.json(result);
  } catch (e) {
    return mapError(res, e, 'Failed to revoke pairing session');
  }
}

export async function getStatus(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }
    const { pairingId } = req.params;
    const result = await pairingService.getStatus(pairingId, userId);
    return res.json(result);
  } catch (e) {
    return mapError(res, e, 'Failed to get pairing status');
  }
}


export async function listDevices(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }
    const result = await pairingService.listDevices(userId);
    return res.json(result);
  } catch (e) {
    return mapError(res, e, 'Failed to list devices');
  }
}

export default { createSession, redeemSession, revokeSession, getStatus, listDevices };