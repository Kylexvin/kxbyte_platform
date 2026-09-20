// src/modules/platform/notifications/routes/notification.routes.js

import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware.authenticate);

// Static routes FIRST
router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.patch('/read/all', notificationController.markAllAsRead);

// Dynamic routes LAST
router.get('/:notificationId', notificationController.getNotification);
router.patch('/:notificationId/read', notificationController.markAsRead);

export default router;