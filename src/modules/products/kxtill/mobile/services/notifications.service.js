// src/modules/products/kxtill/mobile/services/notifications.service.js
//
// Thin wrapper over the platform notification service.
// Adds mobile-specific scoping: organizationId (required), productKey=kxtill,
// optional branchId (from metadata), and per-device read state.

import notificationService from '../../../../platform/notifications/services/notification.service.js';
import notificationDb from '../../../../platform/notifications/db/notification.db.js';
import prisma from '../../../../../database/postgres/prisma.js';

const PRODUCT_KEY = 'kxtill';

export async function listNotifications(ctx, { filter, limit, offset }) {
  const { organizationId } = ctx;

  const filters = {
    organizationId,
    productKey: PRODUCT_KEY,
    limit: typeof limit === 'number' ? limit : 50,
    offset: typeof offset === 'number' ? offset : 0,
  };

  if (filter === 'unread') filters.isRead = false;
  if (filter === 'read') filters.isRead = true;

  const result = await notificationService.getNotifications(
    ctx.user.id,
    filters
  );

  return {
    items: result.items.map(shapeNotification),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    filter: filter || 'all',
  };
}

export async function markRead(ctx, notificationId) {
  // Delegates to platform service which enforces ownership.
  const updated = await notificationService.markAsRead(
    ctx.user.id,
    notificationId
  );
  return shapeNotification(updated);
}

export async function markAllRead(ctx) {
  // The platform service is user-wide. For mobile, restrict to the current
  // organization + productKey by only touching notifications that match.
  const targets = await prisma.notification.findMany({
    where: {
      userId: ctx.user.id,
      organizationId: ctx.organizationId,
      productKey: PRODUCT_KEY,
      readAt: null,
    },
    select: { id: true },
  });
  if (targets.length === 0) return { count: 0 };

  const result = await prisma.notification.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}

export async function unreadCount(ctx) {
  return prisma.notification.count({
    where: {
      userId: ctx.user.id,
      organizationId: ctx.organizationId,
      productKey: PRODUCT_KEY,
      readAt: null,
    },
  });
}

export async function getDetail(ctx, notificationId) {
  const notification = await notificationService.getNotification(
    ctx.user.id,
    notificationId
  );
  if (
    notification.organizationId &&
    notification.organizationId !== ctx.organizationId
  ) {
    throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  }
  if (notification.productKey && notification.productKey !== PRODUCT_KEY) {
    throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  }
  return shapeNotification(notification);
}

// Dev-only: insert a handful of sample notifications for testing.
export async function seedNotifications(ctx) {
  const { organizationId, user } = ctx;

  const samples = [
    {
      type: 'low_stock',
      title: 'Fresh Milk 500ml is almost out',
      message: '6 units left at Main Branch',
      resource: 'branch_product',
      resourceId: 'sample-1',
      metadata: { branchId: null, threshold: 10 },
    },
    {
      type: 'shift_variance',
      title: 'Cash variance KES 1,200',
      message: 'Main Branch shift closed with a variance',
      resource: 'shift',
      resourceId: 'sample-2',
      metadata: { branchId: null },
    },
    {
      type: 'sync_failed',
      title: 'Westlands till is offline',
      message: '3 sales waiting to sync',
      resource: 'device',
      resourceId: 'sample-3',
      metadata: { branchId: null },
    },
    {
      type: 'out_of_stock',
      title: 'Green Tea 250g is out of stock',
      message: 'CBD Branch',
      resource: 'branch_product',
      resourceId: 'sample-4',
      metadata: { branchId: null },
    },
  ];

  const created = [];
  for (const s of samples) {
    const n = await notificationDb.createNotification({
      userId: user.id,
      organizationId,
      type: s.type,
      title: s.title,
      message: s.message,
      channel: 'IN_APP',
      productKey: PRODUCT_KEY,
      resource: s.resource,
      resourceId: s.resourceId,
      metadata: s.metadata,
    });
    created.push(shapeNotification(n));
  }
  return { count: created.length, items: created };
}

function shapeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    channel: n.channel,
    resource: n.resource,
    resourceId: n.resourceId,
    metadata: n.metadata || null,
    read: !!n.readAt,
    readAt: n.readAt || null,
    createdAt: n.createdAt,
    organization:
      n.organization
        ? { id: n.organization.id, name: n.organization.name }
        : null,
  };
}

export default {
  listNotifications,
  markRead,
  markAllRead,
  unreadCount,
  getDetail,
  seedNotifications,
};