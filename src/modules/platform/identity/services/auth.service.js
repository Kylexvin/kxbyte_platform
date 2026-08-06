//src/modules/platform/identity/services/auth.service.js
import authDb from '../db/auth.db.js';
import password from '../utils/password.js';
import crypto from 'crypto';
import jwt from '../utils/jwt.js';

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

const login = async (email, plainPassword) => {
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
    // Don't reveal if email exists or not (security)
    return { message: 'If your email is registered, you will receive a reset link' };
  }

  // Generate reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await authDb.createVerificationToken({
    userId: user.id,
    token,
    type: 'PASSWORD_RESET',
    expiresAt,
  });

  // Log reset link (replace with email service later)
  console.log(`📧 Password reset link: http://localhost:5000/reset-password?token=${token}`);

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

  await authDb.updateUser(verificationToken.userId, {
    password: hashedPassword,
  });

  // Mark token as used
  await authDb.updateVerificationToken(verificationToken.id, {
    usedAt: new Date(),
  });

  // Delete all sessions for this user (force re-login)
  // TODO: Implement deleteAllSessionsByUserId

  return { message: 'Password reset successful' };
};

export default {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};