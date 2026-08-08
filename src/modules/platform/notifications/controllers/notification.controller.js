// src/modules/platform/notifications/controllers/notification.controller.js

import notificationService from '../services/notification.service.js';

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      organizationId,
      type,
      channel,
      isRead,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters = {
      organizationId,
      type,
      channel,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    const result = await notificationService.getNotifications(userId, filters);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getNotification = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notificationId } = req.params;
    const notification = await notificationService.getNotification(userId, notificationId);
    res.status(200).json({ notification });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this notification') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notificationId } = req.params;
    const notification = await notificationService.markAsRead(userId, notificationId);
    res.status(200).json({ message: 'Marked as read', notification });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this notification') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await notificationService.markAllAsRead(userId);
    res.status(200).json({ message: 'All notifications marked as read', count: result.count });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};