// src/modules/platform/notifications/services/notification.engine.js
//
// Platform-level notification engine.
//
// Provides three primitives used by every product's event modules:
//
//   emit(event)             — the "who to notify" engine: find every user
//                             whose membership grants `permissionKey`,
//                             dedupe per resource, and send per user.
//   broadcast(opts)         — lower-level: just find users with a permission.
//   once(opts)              — lower-level: check dedupe before sending.
//
// Product event modules (e.g. kxtill/notifications/events.js) define the
// WHAT; this engine handles the WHO and the WHEN-ALREADY-SENT.

import notificationService from './notification.service.js';
import notificationDb from '../db/notification.db.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';

/**
 * Find all user ids in an organization whose membership grants a permission.
 *
 * Iterates members and calls authorizationService.checkPermission per member
 * so the result agrees with every other permission check in the app
 * (owner wildcard, platform admin wildcard, role-permission matching all
 * honoured). For orgs with >200 members, revisit with a reverse query.
 *
 * @param {string} organizationId
 * @param {string} permissionKey
 * @returns {Promise<string[]>}  user ids
 */
export async function findUsersWithPermission(organizationId, permissionKey) {
  if (!organizationId || !permissionKey) return [];

  const members = await orgDb.findMembersByOrganization(organizationId);
  if (!Array.isArray(members) || members.length === 0) return [];

  const results = await Promise.all(
    members.map(async (m) => {
      try {
        const ok = await authorizationService.checkPermission(
          m.userId,
          organizationId,
          permissionKey
        );
        return ok ? m.userId : null;
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

/**
 * Check whether a matching notification already exists. If it does, returns
 * it; if not, returns null. Used to make an event "fire once".
 */
export async function findExisting({
  type,
  resource,
  resourceId,
  threshold,
}) {
  if (!type || !resource || !resourceId) return null;
  return notificationDb.findNotificationByTypeAndResource({
    type,
    resource,
    resourceId,
    threshold,
  });
}

/**
 * Send a notification to one user, swallowing errors so a single failure
 * does not block the rest of a broadcast.
 *
 * @returns {Promise<object|null>}  created notification or null on failure
 */
async function sendSafe(payload) {
  try {
    return await notificationService.send(payload);
  } catch (e) {
    console.error('[notification.engine] send failed:', e.message);
    return null;
  }
}

/**
 * Broadcast to every user with a permission. Per-user failures are logged
 * and skipped.
 *
 * @param {object} opts
 * @param {string} opts.organizationId
 * @param {string} opts.permissionKey
 * @param {object} opts.notification  { type, title, message, channel, productKey,
 *                                      resource, resourceId, metadata }
 * @returns {Promise<{ sent: number, skipped: number, notifications: object[] }>}
 */
export async function broadcast(opts) {
  const { organizationId, permissionKey, notification } = opts;
  const userIds = await findUsersWithPermission(organizationId, permissionKey);

  const sent = [];
  let failed = 0;
  for (const userId of userIds) {
    const created = await sendSafe({ ...notification, userId, organizationId });
    if (created) sent.push(created);
    else failed++;
  }
  return { sent: sent.length, failed, notifications: sent };
}

/**
 * High-level entry point.
 *
 * @param {object} event
 * @param {string} event.organizationId
 * @param {string} event.type              notification type key
 * @param {string} event.permissionKey     who should receive it
 * @param {object} event.notification      { title, message, channel, productKey,
 *                                           resource, resourceId, metadata }
 * @param {object} [event.dedupe]          { enabled: bool, threshold?: number }
 * @returns {Promise<{ fired: boolean, reason: string, sent: number }>}
 */
export async function emit(event) {
  const {
    organizationId,
    type,
    permissionKey,
    notification,
    dedupe = { enabled: true },
  } = event;

  if (!organizationId || !type || !permissionKey || !notification) {
    return { fired: false, reason: 'invalid_event', sent: 0 };
  }

  // Dedupe: fire once per (type, resource, resourceId, threshold?)
  if (dedupe.enabled && notification.resource && notification.resourceId) {
    const existing = await findExisting({
      type,
      resource: notification.resource,
      resourceId: notification.resourceId,
      threshold: dedupe.threshold,
    });
    if (existing) {
      return { fired: false, reason: 'already_sent', sent: 0 };
    }
  }

  const result = await broadcast({
    organizationId,
    permissionKey,
    notification: { ...notification, type },
  });

  return {
    fired: result.sent > 0,
    reason: result.sent > 0 ? 'sent' : 'no_recipients',
    sent: result.sent,
  };
}

export default { emit, broadcast, findUsersWithPermission, findExisting };