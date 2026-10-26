// src/modules/platform/notifications/services/notification.service.js

import notificationDb from '../db/notification.db.js';
import orgDb from '../../organizations/db/org.db.js';
import { sendNotificationEmail } from '../../email/index.js';
import pushService from './push.service.js';

const send = async (data) => {
  const {
    userId,
    organizationId,
    type,
    title,
    message,
    channel = 'IN_APP',
    productKey,
    resource,
    resourceId,
    metadata,
  } = data;

  // Create notification record
  const notification = await notificationDb.createNotification({
    userId,
    organizationId: organizationId || null,
    type,
    title,
    message,
    channel,
    productKey: productKey || null,
    resource: resource || null,
    resourceId: resourceId || null,
    metadata: metadata || {},
  });

  // Send email if channel includes EMAIL
  if (channel === 'EMAIL' || channel === 'IN_APP') {
    try {
      const user = await orgDb.findUserById(userId);
      if (user && user.email) {
        await sendNotificationEmail(user.email, title, message);
        // Update sentAt
        await notificationDb.markAsSent(notification.id);
      }
    } catch (error) {
      console.error('Failed to send notification email:', error.message);
    }
  }

  // Fan out to push (fire-and-forget). Push failures never break the
  // in-app path — the row above is the source of truth. The push service
  // logs and prunes dead tokens on its own.
  if (productKey) {
    pushService
      .sendPushToUser(userId, productKey, {
        title,
        body: message,
        data: {
          type,
          resource: resource || '',
          resourceId: resourceId || '',
        },
      })
      .catch((e) => {
        console.error(
          '[notification.service] push fan-out failed:',
          e?.message || e
        );
      });
  }

  return notification;
};

const getNotifications = async (userId, filters = {}) => {
  return notificationDb.findNotificationsByUser(userId, filters);
};

const getNotification = async (userId, notificationId) => {
  const notification = await notificationDb.findNotificationById(notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }
  if (notification.userId !== userId) {
    throw new Error('You do not have access to this notification');
  }
  return notification;
};

const markAsRead = async (userId, notificationId) => {
  const notification = await getNotification(userId, notificationId);
  return notificationDb.markAsRead(notification.id);
};

const markAllAsRead = async (userId) => {
  return notificationDb.markAllAsRead(userId);
};

const getUnreadCount = async (userId, productKey) => {
  return notificationDb.countUnread(userId, productKey);
};

export default {
  send,
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};