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

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateUpdateSettings,
};