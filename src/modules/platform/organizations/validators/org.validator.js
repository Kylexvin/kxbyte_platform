// src/modules/platform/organizations/validators/org.validator.js

const validateCreateOrganization = (data) => {
  const { name, country } = data;
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('Organization name is required');
  }

  if (name && name.trim().length < 2) {
    errors.push('Organization name must be at least 2 characters');
  }

  if (!country || country.length !== 2) {
    errors.push('Country is required (2-letter code, e.g., KE, US, GB)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateOrganization = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name.trim().length < 2) {
    errors.push('Organization name must be at least 2 characters');
  }

  if (data.country !== undefined && data.country.length !== 2) {
    errors.push('Country must be a 2-letter code (e.g., KE, US, GB)');
  }

  if (data.currency !== undefined && data.currency.length !== 3) {
    errors.push('Currency must be a 3-letter code (e.g., KES, USD, EUR)');
  }

  if (data.email !== undefined && data.email.length > 0 && !data.email.includes('@')) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateOrganization,
  validateUpdateOrganization,
};