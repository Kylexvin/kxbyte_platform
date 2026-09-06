// src/modules/platform/identity/controllers/social.controller.js

import passport from '../config/passport.config.js';
import socialService from '../services/social.service.js';
import authDb from '../db/auth.db.js';
import authCodeStore from '../utils/authCodeStore.js';

const VALID_CLIENTS = ['kxtill', 'kxinvoice', 'kxcrm', 'kxsuite'];

const ALLOWED_REDIRECTS = {
  kxtill: process.env.KXTILL_REDIRECT_URI || 'http://localhost:3000/kx/kxtill/oauth/callback',
  kxinvoice: process.env.KXINVOICE_REDIRECT_URI || 'http://localhost:3000/kx/kxinvoice/oauth/callback',
  kxcrm: process.env.KXCRM_REDIRECT_URI || 'http://localhost:3000/kx/kxcrm/oauth/callback',
  kxsuite: process.env.KXSUITE_REDIRECT_URI || 'http://localhost:3000/dashboard/oauth/callback',
};

const encodeOAuthState = (client_id, redirect_uri, state) =>
  Buffer.from(JSON.stringify({ client_id, redirect_uri, state: state || '' })).toString('base64url');

const decodeOAuthState = (encoded) => {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const googleAuth = (req, res, next) => {
  const { client_id, redirect_uri, state } = req.query;

  if (!client_id || !VALID_CLIENTS.includes(client_id) || redirect_uri !== ALLOWED_REDIRECTS[client_id]) {
    return res.status(400).send('Invalid client_id or redirect_uri');
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: encodeOAuthState(client_id, redirect_uri, state),
  })(req, res, next);
};

const githubAuth = (req, res, next) => {
  const { client_id, redirect_uri, state } = req.query;

  if (!client_id || !VALID_CLIENTS.includes(client_id) || redirect_uri !== ALLOWED_REDIRECTS[client_id]) {
    return res.status(400).send('Invalid client_id or redirect_uri');
  }

  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
    state: encodeOAuthState(client_id, redirect_uri, state),
  })(req, res, next);
};

const socialCallback = async (req, res) => {
  const decoded = decodeOAuthState(req.query.state);

  if (!decoded || !VALID_CLIENTS.includes(decoded.client_id) || decoded.redirect_uri !== ALLOWED_REDIRECTS[decoded.client_id]) {
    return res.redirect(`http://localhost:3000/login?error=social_auth_failed`);
  }

  const { client_id, redirect_uri, state } = decoded;

  try {
    const { user } = req;

    if (!user) {
      console.error('Social callback: No user found in request');
      return res.redirect(`${redirect_uri}?error=social_auth_failed${state ? `&state=${state}` : ''}`);
    }

    const code = authCodeStore.createAuthCode({
      userId: user.id,
      clientId: client_id,
      redirectUri: redirect_uri,
    });

    console.log(`Social callback: Redirecting user ${user.email} to ${client_id}`);
    res.redirect(`${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`);
  } catch (error) {
    console.error('Social callback error:', error);
    res.redirect(`${redirect_uri}?error=social_auth_failed${state ? `&state=${state}` : ''}`);
  }
};

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
    if (error.message === 'Account already linked to google' ||
        error.message === 'Account already linked to github') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Link social account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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