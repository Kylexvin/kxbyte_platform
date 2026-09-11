// src/modules/platform/customers/validators/customer.validator.js

const validateCreateCustomer = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Customer name is required');
  }

  if (data.name && data.name.length < 2) {
    errors.push('Customer name must be at least 2 characters');
  }

  if (!data.phone && !data.email) {
    errors.push('Either phone or email is required');
  }

  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email address');
  }

  if (data.phone && data.phone.length < 9) {
    errors.push('Phone number must be at least 9 digits');
  }

  if (data.customerType && !['INDIVIDUAL', 'BUSINESS'].includes(data.customerType)) {
    errors.push('Customer type must be INDIVIDUAL or BUSINESS');
  }

  if (data.customerType === 'BUSINESS' && !data.companyName) {
    errors.push('Company name is required for business customers');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateCustomer = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name.length < 2) {
    errors.push('Customer name must be at least 2 characters');
  }

  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email address');
  }

  if (data.customerType && !['INDIVIDUAL', 'BUSINESS'].includes(data.customerType)) {
    errors.push('Customer type must be INDIVIDUAL or BUSINESS');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateCustomer,
  validateUpdateCustomer,
};