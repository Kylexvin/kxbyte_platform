// src/modules/platform/identity/routes/auth.routes.js

import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import dashboardController from '../controllers/dashboard.controller.js';
import socialController from '../controllers/social.controller.js';
import passport from '../config/passport.config.js';

const router = express.Router();

// ============================================================
// STANDARD AUTH
// ============================================================

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);
router.get('/me', authMiddleware.authenticate, authController.getMe);
router.get('/me/dashboard', authMiddleware.authenticate, dashboardController.getDashboardContext);
router.patch('/me', authMiddleware.authenticate, authController.updateProfile);
router.post('/change-password', authMiddleware.authenticate, authController.changePassword);
router.get('/sessions', authMiddleware.authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authMiddleware.authenticate, authController.revokeSession);
router.post('/logout-all', authMiddleware.authenticate, authController.logoutAllDevices);

// ============================================================
// SOCIAL AUTH
// ============================================================

// Initiate social login
router.get('/google', socialController.googleAuth);
router.get('/github', socialController.githubAuth);

// Social callback — uses passport.authenticate middleware
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: '/login?error=google_failed' 
  }),
  socialController.socialCallback
);

router.get(
  '/github/callback',
  passport.authenticate('github', { 
    session: false, 
    failureRedirect: '/login?error=github_failed' 
  }),
  socialController.socialCallback
);

// Social account management
router.get('/social/accounts', authMiddleware.authenticate, socialController.getSocialAccounts);
router.post('/social/link', authMiddleware.authenticate, socialController.linkSocialAccount);
router.delete('/social/:provider', authMiddleware.authenticate, socialController.unlinkSocialAccount);

export default router;