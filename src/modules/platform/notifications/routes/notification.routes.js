// src/modules/platform/notifications/routes/notification.routes.js

import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware.authenticate);

router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.get('/:notificationId', notificationController.getNotification);
router.patch('/:notificationId/read', notificationController.markAsRead);
router.patch('/read/all', notificationController.markAllAsRead);

export default router;