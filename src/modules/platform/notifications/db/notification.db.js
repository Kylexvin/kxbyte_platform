// src/modules/platform/notifications/db/notification.db.js

import prisma from '../../../../database/postgres/prisma.js';

const findNotificationByTypeAndResource = async ({ type, resource, resourceId, threshold }) => {
  return prisma.notification.findFirst({
    where: {
      type,
      resource,
      resourceId,
      ...(threshold !== undefined && {
        metadata: { path: ['threshold'], equals: threshold },
      }),
    },
  });
};

const createNotification = async (data) => {
  return prisma.notification.create({ data });
};

const findNotificationsByUser = async (userId, filters = {}) => {
  const {
    organizationId,
    type,
    channel,
    isRead,
    productKey,
    limit = 50,
    offset = 0,
  } = filters;

  const where = { userId };
  if (organizationId) where.organizationId = organizationId;
  if (type) where.type = type;
  if (channel) where.channel = channel;
  if (isRead !== undefined) where.isRead = isRead;
  if (productKey) where.productKey = productKey;

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const findNotificationById = async (id) => {
  return prisma.notification.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

const markAsRead = async (id) => {
  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
};

const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
};

const countUnread = async (userId, productKey) => {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
      ...(productKey && { productKey }),
    },
  });
};

const markAsSent = async (id) => {
  return prisma.notification.update({
    where: { id },
    data: { sentAt: new Date() },
  });
};

export default {
  findNotificationByTypeAndResource,
  createNotification,
  findNotificationsByUser,
  findNotificationById,
  markAsRead,
  markAllAsRead,
  countUnread,
  markAsSent,

};