// src/modules/products/kxtill/validators/setting.validator.js

const validateUpdateSettings = (data) => {
  const errors = [];

  if (data.shopPhone && data.shopPhone.length < 10) {
    errors.push('Phone number must be at least 10 digits');
  }

  if (data.shopEmail && !data.shopEmail.includes('@')) {
    errors.push('Invalid email address');
  }

  if (data.taxNumber && data.taxNumber.length < 5) {
    errors.push('Tax number must be at least 5 characters');
  }

  if (data.sessionTimeout && (data.sessionTimeout < 5 || data.sessionTimeout > 120)) {
    errors.push('Session timeout must be between 5 and 120 minutes');
  }

  if (data.auditLogRetention && (data.auditLogRetention < 30 || data.auditLogRetention > 365)) {
    errors.push('Audit log retention must be between 30 and 365 days');
  }

  if (data.decimalPlaces && ![0, 1, 2].includes(data.decimalPlaces)) {
    errors.push('Decimal places must be 0, 1, or 2');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateUpdateSettings,
};