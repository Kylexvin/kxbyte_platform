// src/modules/platform/identity/services/auth.service.js

import authDb from '../db/auth.db.js';
import password from '../utils/password.js';
import crypto from 'crypto';
import jwt from '../utils/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordResetConfirmation } from '../email/email.service.js';
import { logAudit } from '../utils/audit.helper.js';
import notifications from '../../notifications/index.js';

const register = async (data) => {
  const { email, password: plainPassword, firstName, lastName } = data;

  const existingUser = await authDb.findUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await password.hashPassword(plainPassword);

  const user = await authDb.createUser({
    email,
    password: hashedPassword,
    firstName,
    lastName,
  });

  const verifyToken = crypto.randomBytes(32).toString('hex');
  await authDb.createVerificationToken({
    userId: user.id,
    token: verifyToken,
    type: 'EMAIL_VERIFICATION',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(user.email, verifyToken, user.firstName);

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Notification: Welcome
  try {
    await notifications.send({
      userId: user.id,
      type: 'USER_REGISTERED',
      title: 'Welcome to KXBYTE!',
      message: `Hello ${firstName}, welcome to KXBYTE. Verify your email to get started.`,
      channel: 'IN_APP',
      metadata: {
        firstName,
        email,
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

const login = async (email, plainPassword, req = null) => {
  const user = await authDb.findUserByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await password.verifyPassword(plainPassword, user.password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Audit log: User logged in
  await logAudit({
    organizationId: null,
    userId: user.id,
    action: 'USER_LOGIN',
    resource: 'user',
    resourceId: user.id,
    metadata: {
      email: user.email,
    },
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  // Notification: Login
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
  };
};

const refreshToken = async (refreshToken) => {
  const session = await authDb.findSessionByToken(refreshToken);
  if (!session) {
    throw new Error('Invalid refresh token');
  }

  if (session.expiresAt < new Date()) {
    throw new Error('Refresh token expired');
  }

  const payload = jwt.verifyRefreshToken(refreshToken);
  const user = await authDb.findUserById(payload.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const newAccessToken = jwt.generateAccessToken(user);
  const newRefreshToken = jwt.generateRefreshToken(user);

  await authDb.deleteSession(session.id);
  await authDb.createSession({
    userId: user.id,
    refreshToken: newRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const { password: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logout = async (refreshToken) => {
  const session = await authDb.findSessionByToken(refreshToken);
  if (session) {
    await authDb.deleteSession(session.id);
  }
  return { message: 'Logged out successfully' };
};

const getMe = async (userId) => {
  const user = await authDb.findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const forgotPassword = async (email) => {
  const user = await authDb.findUserByEmail(email);
  if (!user) {
    return { message: 'If your email is registered, you will receive a reset link' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await authDb.createVerificationToken({
    userId: user.id,
    token,
    type: 'PASSWORD_RESET',
    expiresAt,
  });

  await sendPasswordResetEmail(user.email, token, user.firstName);

  return { message: 'If your email is registered, you will receive a reset link' };
};

const resetPassword = async (token, newPassword) => {
  const verificationToken = await authDb.findVerificationToken(token);
  if (!verificationToken) {
    throw new Error('Invalid or expired reset token');
  }

  if (verificationToken.expiresAt < new Date()) {
    throw new Error('Reset token has expired');
  }

  if (verificationToken.usedAt) {
    throw new Error('Reset token has already been used');
  }

  if (verificationToken.type !== 'PASSWORD_RESET') {
    throw new Error('Invalid token type');
  }

  const hashedPassword = await password.hashPassword(newPassword);

  const user = await authDb.updateUser(verificationToken.userId, {
    password: hashedPassword,
  });

  await authDb.updateVerificationToken(verificationToken.id, {
    usedAt: new Date(),
  });

  await sendPasswordResetConfirmation(user.email, user.firstName);

  // Notification: Password reset completed
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

const verifyEmail = async (token) => {
  const verificationToken = await authDb.findVerificationToken(token);
  if (!verificationToken) {
    throw new Error('Invalid verification token');
  }

  if (verificationToken.expiresAt < new Date()) {
    throw new Error('Verification token has expired');
  }

  if (verificationToken.usedAt) {
    throw new Error('Verification token has already been used');
  }

  if (verificationToken.type !== 'EMAIL_VERIFICATION') {
    throw new Error('Invalid token type');
  }

  const user = await authDb.updateUser(verificationToken.userId, {
    isEmailVerified: true,
  });

  await authDb.updateVerificationToken(verificationToken.id, {
    usedAt: new Date(),
  });

  // Notification: Email verified
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

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await authDb.findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await password.verifyPassword(currentPassword, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new Error('New password must be different from current password');
  }

  const hashedPassword = await password.hashPassword(newPassword);

  await authDb.updateUser(userId, {
    password: hashedPassword,
  });

  // Notification: Password changed
  try {
    await notifications.send({
      userId: user.id,
      type: 'PASSWORD_CHANGED',
      title: 'Password Updated',
      message: 'Your password was changed successfully. If this wasn\'t you, contact support immediately.',
      channel: 'IN_APP',
    });
  } catch (error) {
    console.error('Failed to send password change notification:', error.message);
  }

  return { message: 'Password changed successfully' };
};

const logoutAllDevices = async (userId) => {
  await authDb.deleteAllSessionsByUserId(userId);
  return { message: 'Logged out from all devices' };
};

const getSessions = async (userId) => {
  const sessions = await authDb.findSessionsByUserId(userId);
  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isRevoked: s.isRevoked,
  }));
};

export default {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  logoutAllDevices,
  getSessions,
};