// src/modules/platform/organizations/validators/org.validator.js

const ALLOWED_RETENTION_DAYS = [30, 45, 60, 90];

// Loose phone validation:
// - optional leading +
// - digits, spaces, dashes, parens
// - 7 to 15 digits total (E.164 max is 15)
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

const validateCreateOrganization = (data) => {
  const { name, country, phone } = data;
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

  // ---- phone: required on create ----
  if (!phone || String(phone).trim().length === 0) {
    errors.push('Phone number is required');
  } else {
    const trimmed = String(phone).trim();
    if (!PHONE_REGEX.test(trimmed)) {
      errors.push('Phone number contains invalid characters');
    } else {
      const digits = digitsOnly(trimmed);
      if (digits.length < 7 || digits.length > 15) {
        errors.push('Phone number must be between 7 and 15 digits');
      }
    }
  }

  if (data.auditLogRetention !== undefined && data.auditLogRetention !== null) {
    if (!ALLOWED_RETENTION_DAYS.includes(Number(data.auditLogRetention))) {
      errors.push('Audit log retention must be one of: 30, 45, 60, 90 days');
    }
  }

  return { valid: errors.length === 0, errors };
};

const validateUpdateOrganization = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name !== null) {
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Organization name must be at least 2 characters');
    }
  }

  if (data.country !== undefined && data.country !== null) {
    if (!data.country || data.country.length !== 2) {
      errors.push('Country must be a 2-letter code (e.g., KE, US, GB)');
    }
  }

  if (data.currency !== undefined && data.currency !== null) {
    if (!data.currency || data.currency.length !== 3) {
      errors.push('Currency must be a 3-letter code (e.g., KES, USD, EUR)');
    }
  }

  if (
    data.email !== undefined &&
    data.email !== null &&
    data.email.length > 0 &&
    !data.email.includes('@')
  ) {
    errors.push('Invalid email format');
  }

  // ---- phone: optional on update, but validate format if provided ----
  if (data.phone !== undefined && data.phone !== null && String(data.phone).length > 0) {
    const trimmed = String(data.phone).trim();
    if (!PHONE_REGEX.test(trimmed)) {
      errors.push('Phone number contains invalid characters');
    } else {
      const digits = digitsOnly(trimmed);
      if (digits.length < 7 || digits.length > 15) {
        errors.push('Phone number must be between 7 and 15 digits');
      }
    }
  }

  if (data.auditLogRetention !== undefined && data.auditLogRetention !== null) {
    if (!ALLOWED_RETENTION_DAYS.includes(Number(data.auditLogRetention))) {
      errors.push('Audit log retention must be one of: 30, 45, 60, 90 days');
    }
  }

  return { valid: errors.length === 0, errors };
};

export default {
  validateCreateOrganization,
  validateUpdateOrganization,
};