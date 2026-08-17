// src/modules/platform/identity/controllers/social.controller.js

import passport from '../config/passport.config.js';
import socialService from '../services/social.service.js';
import jwt from '../utils/jwt.js';
import authDb from '../db/auth.db.js';

// ============================================================
// INITIATE SOCIAL LOGIN
// ============================================================

const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

const githubAuth = passport.authenticate('github', {
  scope: ['user:email'],
  session: false,
});

// ============================================================
// SOCIAL CALLBACK
// ============================================================
// src/modules/platform/identity/controllers/social.controller.js

const socialCallback = async (req, res) => {
  try {

    const { user } = req;

    if (!user) {
      console.log('❌ No user found in request');
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=social_auth_failed`
      );
    }


    const accessToken = jwt.generateAccessToken(user);
    const refreshToken = jwt.generateRefreshToken(user);


    await authDb.createSession({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    

    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;


    res.redirect(redirectUrl);
  } catch (error) {
  
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=social_auth_failed`
    );
  }
};

// ============================================================
// LINK SOCIAL ACCOUNT (logged in user)
// ============================================================

const linkSocialAccount = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { provider, providerId, email, name, avatar } = req.body;

    if (!provider || !providerId) {
      return res.status(400).json({ error: 'Provider and providerId are required' });
    }

    const result = await socialService.linkSocialAccount(
      userId,
      { id: providerId, emails: [{ value: email }], displayName: name, photos: [{ value: avatar }] },
      provider
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Account already linked to google') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Link social account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// UNLINK SOCIAL ACCOUNT
// ============================================================

const unlinkSocialAccount = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { provider } = req.params;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const result = await socialService.unlinkSocialAccount(userId, provider);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.includes('No') || error.message.includes('Cannot unlink')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Unlink social account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// GET SOCIAL ACCOUNTS
// ============================================================

const getSocialAccounts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accounts = await authDb.findSocialAccountsByUser(userId);
    res.status(200).json({ accounts });
  } catch (error) {
    console.error('Get social accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  googleAuth,
  githubAuth,
  socialCallback,
  linkSocialAccount,
  unlinkSocialAccount,
  getSocialAccounts,
};