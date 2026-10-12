// src/modules/platform/identity/controllers/auth.controller.js

import authService from '../services/auth.service.js';
import authValidator from '../validators/auth.validator.js';
import {
  ERROR_CODES,
  AppError,
  sendError,
  sendValidationError,
} from '../utils/errors.js';

const AUTH_BASE_URL = process.env.AUTH_BASE_URL || 'http://localhost:5000';

const register = async (req, res) => {
  const validation = authValidator.validateRegister(req.body);
  const { client_id, redirect_uri, state } = req.body;
  const isBrowserFlow = Boolean(client_id && redirect_uri);

  if (!validation.valid) {
    if (isBrowserFlow) {
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/register?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&error=registration_failed`
      );
    }
    return sendValidationError(res, validation.errors);
  }

  try {
    const result = await authService.register(req.body, req);

    if (isBrowserFlow) {
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&registered=true`
      );
    }
    return res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);

    if (isBrowserFlow) {
      const errorCode = error.code === ERROR_CODES.EMAIL_EXISTS ? 'email_exists' : 'registration_failed';
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/register?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&error=${errorCode}`
      );
    }

    if (error.code === ERROR_CODES.EMAIL_EXISTS) {
      return sendError(res, new AppError(ERROR_CODES.EMAIL_EXISTS, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const login = async (req, res) => {
  const validation = authValidator.validateLogin(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.errors);
  }

  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Email or password is incorrect'));
    }
    if (error.code === ERROR_CODES.EMAIL_NOT_VERIFIED) {
      return sendError(
        res,
        new AppError(
          ERROR_CODES.EMAIL_NOT_VERIFIED,
          'Email not verified',
          { email: error.email }
        )
      );
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const refresh = async (req, res) => {
  const validation = authValidator.validateRefreshToken(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.errors);
  }

  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Invalid refresh token' || error.message === 'Refresh token expired') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendValidationError(res, { refreshToken: 'Refresh token required' });
    }
    const result = await authService.logout(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }
    const user = await authService.getMe(userId);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === 'User not found') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }

    const { sessionId } = req.params;
    const result = await authService.revokeSession(userId, sessionId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Session not found' || error.message === 'Cannot revoke current session') {
      return sendError(res, new AppError(ERROR_CODES.VALIDATION_ERROR, error.message));
    }
    console.error('Revoke session error:', error);
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }

    const { firstName, lastName } = req.body;
    const result = await authService.updateProfile(userId, { firstName, lastName });
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'User not found') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, error.message));
    }
    console.error('Update profile error:', error);
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const forgotPassword = async (req, res) => {
  const validation = authValidator.validateForgotPassword(req.body);
  const { email, client_id, redirect_uri, state } = req.body;
  const isBrowserFlow = Boolean(client_id && redirect_uri);

  if (!validation.valid) {
    if (isBrowserFlow) {
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/forgot-password?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&error=registration_failed`
      );
    }
    return sendValidationError(res, validation.errors);
  }

  try {
    const result = await authService.forgotPassword(email);
    if (isBrowserFlow) {
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/forgot-password?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&success=email_sent`
      );
    }
    return res.status(200).json(result);
  } catch (error) {
    if (isBrowserFlow) {
      return res.redirect(
        `${AUTH_BASE_URL}/api/v1/auth/forgot-password?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}${state ? `&state=${state}` : ''}&success=email_sent`
      );
    }
    if (error.message && error.message.startsWith('Too many reset requests')) {
      return sendError(res, new AppError(ERROR_CODES.RATE_LIMITED, error.message));
    }
    return res.status(200).json({ message: 'If your email is registered, you will receive a reset link' });
  }
};

const resetPassword = async (req, res) => {
  const validation = authValidator.validateResetPassword(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.errors);
  }

  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.status(200).json(result);
  } catch (error) {
    if (
      error.message === 'Invalid or expired reset token' ||
      error.message === 'Reset token has expired' ||
      error.message === 'Reset token has already been used' ||
      error.message === 'Invalid token type'
    ) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_RESET_TOKEN, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return sendValidationError(res, { token: 'Verification token required' });
    }
    const result = await authService.verifyEmail(token);
    res.status(200).json(result);
  } catch (error) {
    if (
      error.message === 'Invalid verification token' ||
      error.message === 'Verification token has expired' ||
      error.message === 'Verification token has already been used' ||
      error.message === 'Invalid token type'
    ) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_VERIFICATION_TOKEN, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const resendVerification = async (req, res) => {
  const validation = authValidator.validateForgotPassword(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.errors);
  }

  try {
    const { email } = req.body;
    const result = await authService.resendVerification(email, req);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Resend verification error:', error);
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const changePassword = async (req, res) => {
  const validation = authValidator.validateChangePassword(req.body);
  if (!validation.valid) {
    return sendValidationError(res, validation.errors);
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }

    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'User not found') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, error.message));
    }
    if (error.message === 'Current password is incorrect') {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, error.message));
    }
    if (error.message === 'New password must be different from current password') {
      return sendError(res, new AppError(ERROR_CODES.VALIDATION_ERROR, error.message));
    }
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }
    const result = await authService.logoutAllDevices(userId);
    res.status(200).json(result);
  } catch (error) {
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

const getSessions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Unauthorized'));
    }
    const sessions = await authService.getSessions(userId);
    res.status(200).json({ sessions });
  } catch (error) {
    return sendError(res, new AppError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error'));
  }
};

export default {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  getSessions,
  logoutAllDevices,
  revokeSession,
};