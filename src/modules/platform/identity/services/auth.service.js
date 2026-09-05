// src/modules/platform/identity/services/auth.service.js

import authDb from '../db/auth.db.js';
import password from '../utils/password.js';
import crypto from 'crypto';
import jwt from '../utils/jwt.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
} from '../email/email.service.js';
import audit from '../../audit/index.js';
import notifications from '../../notifications/index.js';

const TOKEN_EXPIRY = {
  VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  REFRESH: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const RATE_LIMITS = {
  PASSWORD_RESET: {
    maxRequests: 3,
    timeWindowSeconds: 3600,
  },
};

/**
 * Hash a token for secure storage.
 * Tokens are stored as SHA-256 hashes to prevent exposure in case of database breach.
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Register a new user account.
 * Creates user, generates verification token, and issues JWT tokens.
 */
const register = async (data) => {
  const { email, password: plainPassword, firstName, lastName } = data;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await authDb.findUserByEmail(normalizedEmail);

  if (existingUser) {
    // Generic error to prevent email enumeration
    throw new Error('Registration failed');
  }

  const hashedPassword = await password.hashPassword(plainPassword);

  const user = await authDb.createUser({
    email: normalizedEmail,
    password: hashedPassword,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  });

  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = hashToken(rawVerifyToken);

  await authDb.createVerificationToken({
    userId: user.id,
    token: hashedVerifyToken,
    type: 'EMAIL_VERIFICATION',
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.VERIFICATION),
  });

  // Send email with raw token (frontend receives unhashed token)
  await sendVerificationEmail(user.email, rawVerifyToken, user.firstName);

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.REFRESH),
  });

  // Audit: User registration
  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'USER_REGISTERED',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email,
    },
  });

  // Notification: Welcome (non-blocking)
  try {
    await notifications.send({
      userId: user.id,
      type: 'USER_REGISTERED',
      title: 'Welcome to KXBYTE!',
      message: `Hello ${firstName}, welcome to KXBYTE. Verify your email to get started.`,
      channel: 'IN_APP',
      metadata: {
        firstName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Failed to send welcome notification:', error.message);
  }

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
};

/**
 * Authenticate a user with email and password.
 * Returns JWT tokens and organization context on success.
 */
const login = async (email, plainPassword, req = null) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await authDb.findActiveUserByEmail(normalizedEmail);

  if (!user) {
    await audit.log({
      organizationId: null,
      userId: null,
      action: 'USER_LOGIN_FAILED',
      resource: 'user',
      resourceId: null,
      metadata: {
        email: normalizedEmail,
        reason: 'User not found or inactive',
      },
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    throw new Error('Invalid credentials');
  }

  const isValid = await password.verifyPassword(plainPassword, user.password);

  if (!isValid) {
    await audit.log({
      organizationId: null,
      userId: user.id,
      action: 'USER_LOGIN_FAILED',
      resource: 'user',
      resourceId: user.id,
      metadata: {
        email: user.email,
        reason: 'Invalid password',
      },
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    throw new Error('Invalid credentials');
  }

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  const session = await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.REFRESH),
  });

  const organizations = await authDb.findOrganizationsByUserId(user.id);

  const formattedOrgs = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.ownerId === user.id ? 'Owner' : 'Member',
  }));

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'USER_LOGIN',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email,
      sessionId: session.id,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  // Update last login timestamp
  await authDb.updateUser(user.id, {
    lastLoginAt: new Date(),
  });

  // Notification: Login (non-blocking)
  try {
    await notifications.send({
      userId: user.id,
      type: 'USER_LOGIN',
      title: 'Login detected',
      message: `You logged in from ${req?.ip || 'unknown location'}`,
      channel: 'IN_APP',
      metadata: {
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
    });
  } catch (error) {
    console.error('Failed to send login notification:', error.message);
  }

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
    organizations: formattedOrgs,
  };
};

/**
 * Refresh an expired access token using a valid refresh token.
 * Implements token rotation with reuse detection.
 */
const refreshToken = async (refreshToken, req = null) => {
  const session = await authDb.findActiveSessionWithUser(refreshToken);

  if (!session) {
    // Check if token exists but is revoked or expired
    const existingSession = await authDb.findSessionByToken(refreshToken);

    if (existingSession) {
      // Token exists but is revoked or expired - potential reuse attempt
      if (existingSession.isRevoked || existingSession.expiresAt < new Date()) {
        await audit.log({
          organizationId: null,
          userId: existingSession.userId,
          action: 'TOKEN_REUSE_ATTEMPT',
          resource: 'session',
          resourceId: existingSession.id,
          metadata: {
            reason: existingSession.isRevoked ? 'Revoked token used' : 'Expired token used',
          },
          ipAddress: req?.ip,
          userAgent: req?.headers?.['user-agent'],
        });

        // Revoke all sessions for this user as a security measure
        await authDb.revokeAllUserSessions(existingSession.userId);
      }
    }

    throw new Error('Invalid refresh token');
  }

  const payload = jwt.verifyRefreshToken(refreshToken);
  const user = session.user;

  if (!user || !user.isActive || user.deletedAt) {
    throw new Error('Invalid refresh token');
  }

  // Token rotation: revoke old session, create new one
  await authDb.revokeSession(session.id);

  const newAccessToken = jwt.generateAccessToken(user);
  const newRefreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken: newRefreshToken,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.REFRESH),
  });

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'TOKEN_REFRESHED',
    resource: 'session',
    resourceId: session.id,
    metadata: {
      oldSessionId: session.id,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout a user by invalidating their refresh token.
 */
const logout = async (refreshToken) => {
  const session = await authDb.findSessionByToken(refreshToken);

  if (session) {
    await authDb.revokeSession(session.id);
  }

  return { message: 'Logged out successfully' };
};

/**
 * Revoke a specific user session by ID.
 * Prevents revoking the current session through controller validation.
 */
const revokeSession = async (userId, sessionId) => {
  const sessions = await authDb.findSessionsByUserId(userId);
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  await audit.log({
    organizationId: null,
    userId: userId,
    action: 'SESSION_REVOKED',
    resource: 'session',
    resourceId: sessionId,
  });

  await authDb.revokeSession(sessionId);

  return { message: 'Session revoked successfully' };
};

/**
 * Get the current authenticated user's profile.
 */
const getMe = async (userId) => {
  const user = await authDb.findActiveUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const { password: _, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

/**
 * Update a user's profile information.
 */
const updateProfile = async (userId, data) => {
  const user = await authDb.findActiveUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const updateData = {};

  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName.trim();
  }

  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName.trim();
  }

  const updated = await authDb.updateUser(userId, updateData);

  const { password: _, ...userWithoutPassword } = updated;

  return userWithoutPassword;
};

/**
 * Initiate a password reset flow.
 * Always returns a success message to prevent email enumeration.
 * Implements rate limiting to prevent abuse.
 */
const forgotPassword = async (email, req = null) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limiting: prevent excessive reset requests
  const recentRequests = await authDb.countPasswordResetRequests(
    normalizedEmail,
    RATE_LIMITS.PASSWORD_RESET.timeWindowSeconds
  );

  if (recentRequests >= RATE_LIMITS.PASSWORD_RESET.maxRequests) {
    throw new Error('Too many reset requests. Please try again later.');
  }

  const user = await authDb.findActiveUserByEmail(normalizedEmail);

  // Always return the same message regardless of user existence
  if (!user) {
    await audit.log({
      organizationId: null,
      userId: null,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'user',
      resourceId: null,
      metadata: {
        email: normalizedEmail,
        reason: 'User not found',
      },
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    return {
      message: 'If your email is registered, you will receive a reset link',
    };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);

  await authDb.createVerificationToken({
    userId: user.id,
    token: hashedToken,
    type: 'PASSWORD_RESET',
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET),
  });

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  await sendPasswordResetEmail(user.email, rawToken, user.firstName);

  return {
    message: 'If your email is registered, you will receive a reset link',
  };
};

/**
 * Reset a user's password using a valid reset token.
 */
const resetPassword = async (token, newPassword, req = null) => {
  const hashedToken = hashToken(token);
  const verificationToken = await authDb.findUnusedVerificationTokenByType(
    hashedToken,
    'PASSWORD_RESET'
  );

  if (!verificationToken) {
    throw new Error('Invalid or expired reset token');
  }

  const hashedPassword = await password.hashPassword(newPassword);

  const user = await authDb.updateUser(verificationToken.userId, {
    password: hashedPassword,
  });

  await authDb.markVerificationTokenUsed(verificationToken.id);

  // Revoke all sessions after password reset as a security measure
  await authDb.revokeAllUserSessions(user.id);

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      resetTokenId: verificationToken.id,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  await sendPasswordResetConfirmation(user.email, user.firstName);

  try {
    await notifications.send({
      userId: user.id,
      type: 'PASSWORD_RESET_COMPLETED',
      title: 'Password Reset',
      message: 'Your password has been reset successfully.',
      channel: 'IN_APP',
    });
  } catch (error) {
    console.error('Failed to send password reset notification:', error.message);
  }

  return { message: 'Password reset successful' };
};

/**
 * Verify a user's email address using a verification token.
 */
const verifyEmail = async (token, req = null) => {
  const hashedToken = hashToken(token);
  const verificationToken = await authDb.findUnusedVerificationTokenByType(
    hashedToken,
    'EMAIL_VERIFICATION'
  );

  if (!verificationToken) {
    throw new Error('Invalid verification token');
  }

  const user = await authDb.updateUser(verificationToken.userId, {
    isEmailVerified: true,
  });

  await authDb.markVerificationTokenUsed(verificationToken.id);

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'EMAIL_VERIFIED',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      verificationTokenId: verificationToken.id,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  try {
    await notifications.send({
      userId: user.id,
      type: 'EMAIL_VERIFIED',
      title: 'Email Verified',
      message: 'Your email has been verified successfully.',
      channel: 'IN_APP',
    });
  } catch (error) {
    console.error('Failed to send email verification notification:', error.message);
  }

  return { message: 'Email verified successfully' };
};

/**
 * Change a user's password after validating their current password.
 */
const changePassword = async (userId, currentPassword, newPassword, req = null) => {
  const user = await authDb.findActiveUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await password.verifyPassword(currentPassword, user.password);

  if (!isValid) {
    await audit.log({
      organizationId: null,
      userId: user.id,
      action: 'PASSWORD_CHANGE_FAILED',
      resource: 'user',
      resourceId: user.id,
      metadata: {
        reason: 'Invalid current password',
      },
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });

    throw new Error('Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new Error('New password must be different from current password');
  }

  const hashedPassword = await password.hashPassword(newPassword);

  await authDb.updateUser(userId, {
    password: hashedPassword,
  });

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'PASSWORD_CHANGED',
    resource: 'user',
    resourceId: user.id,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  try {
    await notifications.send({
      userId: user.id,
      type: 'PASSWORD_CHANGED',
      title: 'Password Updated',
      message: "Your password was changed successfully. If this wasn't you, contact support immediately.",
      channel: 'IN_APP',
    });
  } catch (error) {
    console.error('Failed to send password change notification:', error.message);
  }

  return { message: 'Password changed successfully' };
};

/**
 * Logout a user from all active sessions.
 */
const logoutAllDevices = async (userId, req = null) => {
  await authDb.revokeAllUserSessions(userId);

  await audit.log({
    organizationId: null,
    userId: userId,
    action: 'USER_LOGOUT_ALL',
    resource: 'user',
    resourceId: userId,
    metadata: {
      action: 'Logged out from all devices',
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  return { message: 'Logged out from all devices' };
};

/**
 * Get all active and inactive sessions for a user.
 */
const getSessions = async (userId) => {
  const sessions = await authDb.findSessionsByUserId(userId);

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isRevoked: session.isRevoked,
    isActive: !session.isRevoked && session.expiresAt > new Date(),
  }));
};

export default {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  revokeSession,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  logoutAllDevices,
  getSessions,
};