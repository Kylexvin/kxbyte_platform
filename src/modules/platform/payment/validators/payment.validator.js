// src/modules/platform/payment/validators/payment.validator.js

const validateMerchantConfig = (data) => {
  const errors = [];

  if (!data.environment || !['SANDBOX', 'LIVE'].includes(data.environment.toUpperCase())) {
    errors.push('Environment must be "SANDBOX" or "LIVE"');
  }

  if (!data.consumerKey || data.consumerKey.trim().length === 0) {
    errors.push('Consumer key is required');
  }

  if (!data.consumerSecret || data.consumerSecret.trim().length === 0) {
    errors.push('Consumer secret is required');
  }

  return { valid: errors.length === 0, errors };
};

const validateInitiatePayment = (data) => {
  const errors = [];

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!data.currency || data.currency.trim().length !== 3) {
    errors.push('Currency must be a valid ISO 3-letter code');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (data.description && data.description.length > 100) {
    errors.push('Description must be 100 characters or less');
  }

  if (!data.productId || data.productId.trim().length === 0) {
    errors.push('Product ID is required');
  }

  // Billing address validation
  if (data.billingAddress) {
    const { emailAddress, phoneNumber } = data.billingAddress;
    if (!emailAddress && !phoneNumber) {
      errors.push('Either email address or phone number is required');
    }
    if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      errors.push('Invalid email address');
    }
  }

  return { valid: errors.length === 0, errors };
};

const validateUpdateTransaction = (data) => {
  const errors = [];

  if (data.status && !['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'].includes(data.status)) {
    errors.push('Invalid status');
  }

  return { valid: errors.length === 0, errors };
};

export default {
  validateMerchantConfig,
  validateInitiatePayment,
  validateUpdateTransaction,
};