// src/modules/platform/audit/validators/audit.validator.js

const validateLogEvent = (data) => {
  const { action, resource } = data;
  const errors = [];

  if (!action || action.trim().length === 0) {
    errors.push('Action is required');
  }

  if (!resource || resource.trim().length === 0) {
    errors.push('Resource is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateQueryFilters = (data) => {
  const { limit, offset } = data;
  const errors = [];

  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    errors.push('Limit must be between 1 and 100');
  }

  if (offset && (isNaN(offset) || offset < 0)) {
    errors.push('Offset must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateLogEvent,
  validateQueryFilters,
};