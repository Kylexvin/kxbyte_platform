// src/modules/platform/identity/routes/auth.routes.js

import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);
router.get('/me', authMiddleware.authenticate, authController.getMe);
router.get('/me/dashboard', authMiddleware.authenticate, dashboardController.getDashboardContext); // ← Add this
router.patch('/me', authMiddleware.authenticate, authController.updateProfile);
router.post('/change-password', authMiddleware.authenticate, authController.changePassword);
router.get('/sessions', authMiddleware.authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authMiddleware.authenticate, authController.revokeSession);
router.post('/logout-all', authMiddleware.authenticate, authController.logoutAllDevices);

export default router;