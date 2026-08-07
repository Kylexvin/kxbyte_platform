// src/modules/platform/organizations/validators/invitation.validator.js

const validateSendInvitation = (data) => {
  const { email, roleId } = data;
  const errors = [];

  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
  }

  if (email && !email.includes('@')) {
    errors.push('Valid email is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateAcceptInvitation = (data) => {
  const { token } = data;
  const errors = [];

  if (!token || token.trim().length === 0) {
    errors.push('Invitation token is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateRejectInvitation = (data) => {
  const { token } = data;
  const errors = [];

  if (!token || token.trim().length === 0) {
    errors.push('Invitation token is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateSendInvitation,
  validateAcceptInvitation,
  validateRejectInvitation,
};