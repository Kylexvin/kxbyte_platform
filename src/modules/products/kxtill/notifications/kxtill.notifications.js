// src/modules/products/kxtill/notifications/kxtill.notifications.js
//
// Thin product-level wrapper over the platform engine. Trigger points call
// these — never the engine directly, never the events directly.

import { emit } from '../../../platform/notifications/services/notification.engine.js';
import events from './events.js';

/**
 * Fires when a shift closes (cashier, manager force, or handover) with a
 * variance above the branch threshold (status CLOSED_PENDING_REVIEW).
 * Deduped per shift id — fires once, even if the same shift is re-closed
 * or reviewed.
 */
export async function notifyShiftVariance(shift) {
  if (!shift || shift.status !== 'CLOSED_PENDING_REVIEW') return null;
  return emit(events.shiftVariance(shift));
}

/**
 * Fires when a sale takes a branch product from `> minStock` to `<= minStock`.
 * The caller is responsible for only invoking this on that transition —
 * this function does not re-check thresholds, it just emits.
 */
export async function notifyLowStock(payload) {
  return emit(events.lowStock(payload));
}

/**
 * Fires when a sale takes a branch product all the way to 0.
 */
export async function notifyOutOfStock(payload) {
  return emit(events.outOfStock(payload));
}

export default { notifyShiftVariance, notifyLowStock, notifyOutOfStock };