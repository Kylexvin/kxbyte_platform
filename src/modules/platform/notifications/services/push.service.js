// src/modules/platform/notifications/services/push.service.js
//
// Sends a push notification to a user for a given product. Looks up their
// device tokens, resolves the product's provider, sends per-token, and
// prunes tokens that FCM reports as invalid.
//
// Never throws to the caller: a push failure must not break the in-app
// notification flow that triggered it. All failures are logged.

import deviceTokenService from './deviceToken.service.js';
import { resolveProvider } from '../providers/provider.registry.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export async function sendPushToUser(userId, productKey, { title, body, data }) {
  try {
    const provider = resolveProvider(productKey);
    if (!provider) {
      return { sent: 0, skipped: 'provider_not_configured' };
    }

    const tokens = await deviceTokenService.tokensForUser(userId, productKey);
    if (!tokens.length) {
      return { sent: 0, skipped: 'no_tokens' };
    }

    let sent = 0;
    let failed = 0;

    for (const row of tokens) {
      try {
        await provider.send({
          token: row.token,
          title,
          body,
          data,
        });
        sent++;
      } catch (e) {
        failed++;
        if (INVALID_TOKEN_CODES.has(e?.code) || INVALID_TOKEN_CODES.has(e?.errorInfo?.code)) {
          // Dead token — remove it so we do not keep retrying.
          await deviceTokenService.pruneToken(row.token);
        } else {
          console.error('[push.service] send failed:', e.message);
        }
      }
    }

    return { sent, failed };
  } catch (e) {
    console.error('[push.service] unexpected failure:', e.message);
    return { sent: 0, error: e.message };
  }
}

export default { sendPushToUser };