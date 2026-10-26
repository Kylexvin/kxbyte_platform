// src/modules/platform/notifications/services/deviceToken.service.js

import deviceTokenDb from '../db/deviceToken.db.js';

export async function register(userId, productKey, { token, platform, deviceLabel }) {
  if (!userId || !productKey || !token || !platform) {
    throw Object.assign(new Error('Missing required fields'), {
      status: 400,
      code: 'INVALID_INPUT',
    });
  }
  return deviceTokenDb.upsert({
    userId,
    productKey,
    token,
    platform,
    deviceLabel: deviceLabel || null,
  });
}

export async function unregister(token) {
  if (!token) {
    throw Object.assign(new Error('Missing token'), {
      status: 400,
      code: 'INVALID_INPUT',
    });
  }
  await deviceTokenDb.deleteByToken(token);
  return { removed: true };
}

export async function tokensForUser(userId, productKey) {
  return deviceTokenDb.findByUserAndProduct(userId, productKey);
}

export async function pruneToken(token) {
  await deviceTokenDb.deleteByToken(token);
}

export default { register, unregister, tokensForUser, pruneToken };