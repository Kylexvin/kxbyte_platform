// src/modules/platform/branches/validators/branch.validator.js

const validateCreateBranch = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Branch name is required');
  }

  if (data.name && data.name.length < 2) {
    errors.push('Branch name must be at least 2 characters');
  }

  if (!data.code || data.code.trim().length === 0) {
    errors.push('Branch code is required');
  }

  if (data.code && data.code.length < 2) {
    errors.push('Branch code must be at least 2 characters');
  }

  if (data.code && !/^[A-Z0-9_-]+$/.test(data.code)) {
    errors.push('Branch code must contain only uppercase letters, numbers, underscores, and hyphens');
  }

  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email address');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateBranch = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name.length < 2) {
    errors.push('Branch name must be at least 2 characters');
  }

  if (data.code !== undefined && data.code.length < 2) {
    errors.push('Branch code must be at least 2 characters');
  }

  if (data.code && !/^[A-Z0-9_-]+$/.test(data.code)) {
    errors.push('Branch code must contain only uppercase letters, numbers, underscores, and hyphens');
  }

  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email address');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateBranch,
  validateUpdateBranch,
};