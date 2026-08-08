// src/modules/platform/notifications/index.js

import notificationRoutes from './routes/notification.routes.js';
import notificationService from './services/notification.service.js';

const register = (app) => {
  app.use('/api/v1/notifications', notificationRoutes);
};

export default {
  register,
  send: notificationService.send,
  getNotifications: notificationService.getNotifications,
  getNotification: notificationService.getNotification,
  markAsRead: notificationService.markAsRead,
  markAllAsRead: notificationService.markAllAsRead,
  getUnreadCount: notificationService.getUnreadCount,
};