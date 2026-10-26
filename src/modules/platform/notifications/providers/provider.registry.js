// src/modules/platform/notifications/providers/provider.registry.js
//
// Resolves a provider for a given productKey. Today there is exactly one
// provider implementation (Firebase). The registry exists so future
// channels (APNs direct, OneSignal, web push) can be added without the
// notification engine knowing about them.

import firebaseProvider from './firebase.provider.js';

const PROVIDERS = {
  firebase: firebaseProvider,
};

/**
 * Resolve a provider for a product. Returns an object with `send`, or null
 * if the product has no configured Firebase project.
 */
export function resolveProvider(productKey) {
  const firebase = PROVIDERS.firebase;
  if (!firebase.isConfigured(productKey)) return null;

  return {
    name: 'firebase',
    async send({ token, title, body, data }) {
      const messaging = firebase.getFirebaseMessaging(productKey);
      if (!messaging) throw new Error('Firebase not configured');
      return messaging.send({
        token,
        notification: { title, body },
        data: stringifyData(data),
        android: { priority: 'high' },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });
    },
  };
}

// FCM `data` values must all be strings. Convert anything else.
function stringifyData(data) {
  if (!data) return {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

export default { resolveProvider };