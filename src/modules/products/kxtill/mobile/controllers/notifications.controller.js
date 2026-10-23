// src/modules/products/kxtill/mobile/controllers/notifications.controller.js

import { ok } from '../common/envelope.js';
import notificationsService from '../services/notifications.service.js';

export async function list(req, res) {
  try {
    const ctx = req.mobileContext;
    const filter = typeof req.query.filter === 'string' ? req.query.filter : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;
    const data = await notificationsService.listNotifications(ctx, {
      filter,
      limit,
      offset,
    });
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/notifications/list]', e);
    res.status(500).json({ code: 'NOTIFICATIONS_FAILED', message: 'Could not load notifications' });
  }
}

export async function detail(req, res) {
  try {
    const ctx = req.mobileContext;
    const data = await notificationsService.getDetail(ctx, req.params.id);
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    const status = e?.status || 500;
    res.status(status).json({
      code: e?.code || 'NOTIFICATIONS_FAILED',
      message: e?.message || 'Could not load notification',
    });
  }
}

export async function markRead(req, res) {
  try {
    const ctx = req.mobileContext;
    const data = await notificationsService.markRead(ctx, req.params.id);
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    const status = e?.status || 500;
    res.status(status).json({
      code: e?.code || 'MARK_READ_FAILED',
      message: e?.message || 'Could not mark as read',
    });
  }
}

export async function markAllRead(req, res) {
  try {
    const ctx = req.mobileContext;
    const data = await notificationsService.markAllRead(ctx);
    res.json(ok(data, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/notifications/mark-all-read]', e);
    res.status(500).json({ code: 'MARK_ALL_READ_FAILED', message: 'Could not mark all as read' });
  }
}

export async function unreadCount(req, res) {
  try {
    const ctx = req.mobileContext;
    const count = await notificationsService.unreadCount(ctx);
    res.json(ok({ count }, { source: 'live' }));
  } catch (e) {
    console.error('[mobile/notifications/unread-count]', e);
    res.status(500).json({ code: 'UNREAD_COUNT_FAILED', message: 'Could not count unread' });
  }
}

export async function seed(req, res) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not available in production' });
    }
    const ctx = req.mobileContext;
    const data = await notificationsService.seedNotifications(ctx);
    res.json(ok(data, { source: 'seed' }));
  } catch (e) {
    console.error('[mobile/notifications/seed]', e);
    res.status(500).json({ code: 'SEED_FAILED', message: 'Could not seed notifications' });
  }
}

export default {
  list,
  detail,
  markRead,
  markAllRead,
  unreadCount,
  seed,
};