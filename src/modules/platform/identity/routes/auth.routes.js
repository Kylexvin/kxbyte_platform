// src/modules/platform/identity/routes/auth.routes.js

import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import dashboardController from '../controllers/dashboard.controller.js';
import socialController from '../controllers/social.controller.js';
import passport from '../config/passport.config.js';
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  socialAuthLimiter,
  sessionLimiter,
} from '../../../../config/rate-limit.config.js';

const router = express.Router();

// Standard auth with rate limiting
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);

// Protected routes with session limiting
router.get('/me', authMiddleware.authenticate, authController.getMe);
router.get('/me/dashboard', authMiddleware.authenticate, dashboardController.getDashboardContext);
router.patch('/me', authMiddleware.authenticate, authController.updateProfile);
router.post('/change-password', authMiddleware.authenticate, authController.changePassword);
router.get('/sessions', authMiddleware.authenticate, sessionLimiter, authController.getSessions);
router.delete('/sessions/:sessionId', authMiddleware.authenticate, sessionLimiter, authController.revokeSession);
router.post('/logout-all', authMiddleware.authenticate, authController.logoutAllDevices);

// Social auth with rate limiting
router.get('/google', socialAuthLimiter, socialController.googleAuth);
router.get('/github', socialAuthLimiter, socialController.githubAuth);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=google_failed',
  }),
  socialController.socialCallback
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/login?error=github_failed',
  }),
  socialController.socialCallback
);

// Social account management
router.get('/social/accounts', authMiddleware.authenticate, socialController.getSocialAccounts);
router.post('/social/link', authMiddleware.authenticate, socialController.linkSocialAccount);
router.delete('/social/:provider', authMiddleware.authenticate, socialController.unlinkSocialAccount);

export default router;