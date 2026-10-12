// src/modules/platform/identity/validators/auth.validator.js

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegister = (data) => {
  const { email, password, firstName, lastName } = data;
  const errors = {};

  if (!email || !EMAIL_RE.test(email)) {
    errors.email = 'Valid email is required';
  }

  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!firstName || firstName.trim().length === 0) {
    errors.firstName = 'First name is required';
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.lastName = 'Last name is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateLogin = (data) => {
  const { email, password } = data;
  const errors = {};

  if (!email || !EMAIL_RE.test(email)) {
    errors.email = 'Valid email is required';
  }

  if (!password || password.length === 0) {
    errors.password = 'Password is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateRefreshToken = (data) => {
  const { refreshToken } = data;
  const errors = {};

  if (!refreshToken || refreshToken.trim().length === 0) {
    errors.refreshToken = 'Refresh token is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateForgotPassword = (data) => {
  const { email } = data;
  const errors = {};

  if (!email || !EMAIL_RE.test(email)) {
    errors.email = 'Valid email is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateResetPassword = (data) => {
  const { token, newPassword } = data;
  const errors = {};

  if (!token || token.trim().length === 0) {
    errors.token = 'Reset token is required';
  }

  if (!newPassword || newPassword.length < 8) {
    errors.newPassword = 'Password must be at least 8 characters';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateChangePassword = (data) => {
  const { currentPassword, newPassword } = data;
  const errors = {};

  if (!currentPassword || currentPassword.length < 8) {
    errors.currentPassword = 'Current password must be at least 8 characters';
  }

  if (!newPassword || newPassword.length < 8) {
    errors.newPassword = 'New password must be at least 8 characters';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export default {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
};