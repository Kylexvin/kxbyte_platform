// src/modules/platform/identity/services/social.service.js

import crypto from 'crypto';
import authDb from '../db/auth.db.js';
import jwt from '../utils/jwt.js';
import audit from '../../audit/index.js';
import password from '../utils/password.js';

const findOrCreateUser = async (profile, provider) => {
  const { id: providerId, emails, displayName, name, photos } = profile;
  const email = emails?.[0]?.value;

  if (!email) {
    throw new Error('Email is required from social provider');
  }

  // Check if social account already exists
  const existingSocial = await authDb.findSocialAccount(provider, providerId);
  if (existingSocial) {
    const user = await authDb.findUserById(existingSocial.userId);
    if (user) {
      return user;
    }
  }

  // Check if user exists with this email
  let user = await authDb.findUserByEmail(email);

  if (user) {
    // Link social account to existing user
    await authDb.createSocialAccount({
      userId: user.id,
      provider,
      providerId,
      email,
      name: displayName || `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
      avatar: photos?.[0]?.value || null,
    });
    return user;
  }

  // Create new user
  const firstName = name?.givenName || displayName?.split(' ')[0] || 'User';
  const lastName = name?.familyName || displayName?.split(' ').slice(1).join(' ') || '';

  // Generate random password (user will never use it)
  const randomPassword = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await password.hashPassword(randomPassword);

  user = await authDb.createUser({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    isEmailVerified: true,
    isActive: true,
  });

  // Create social account link
  await authDb.createSocialAccount({
    userId: user.id,
    provider,
    providerId,
    email,
    name: displayName || `${firstName} ${lastName}`.trim(),
    avatar: photos?.[0]?.value || null,
  });

  // Audit log
  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'USER_REGISTERED_SOCIAL',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      provider,
      email,
    },
  });

  return user;
};

const loginWithSocial = async (profile, provider) => {
  const user = await findOrCreateUser(profile, provider);

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const { password: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
};

const linkSocialAccount = async (userId, profile, provider) => {
  const { id: providerId, emails, displayName, name, photos } = profile;
  const email = emails?.[0]?.value;

  if (!email) {
    throw new Error('Email is required from social provider');
  }

  // Check if social account already exists
  const existing = await authDb.findSocialAccount(provider, providerId);
  if (existing) {
    throw new Error(`Account already linked to ${provider}`);
  }

  // Check if this social account is linked to another user
  const existingSocial = await authDb.findSocialAccountByEmail(email, provider);
  if (existingSocial && existingSocial.userId !== userId) {
    throw new Error(`This ${provider} account is already linked to another user`);
  }

  await authDb.createSocialAccount({
    userId,
    provider,
    providerId,
    email,
    name: displayName || `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
    avatar: photos?.[0]?.value || null,
  });

  return { message: `${provider} account linked successfully` };
};

const unlinkSocialAccount = async (userId, provider) => {
  const socialAccount = await authDb.findSocialAccountByUser(userId, provider);
  if (!socialAccount) {
    throw new Error(`No ${provider} account linked`);
  }

  // Check if user has other login methods
  const user = await authDb.findUserById(userId);
  if (user && !user.password) {
    throw new Error('Cannot unlink the only login method. Please set a password first.');
  }

  await authDb.deleteSocialAccount(socialAccount.id);
  return { message: `${provider} account unlinked successfully` };
};

export default {
  findOrCreateUser,
  loginWithSocial,
  linkSocialAccount,
  unlinkSocialAccount,
};