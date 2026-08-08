// src/modules/platform/subscriptions/validators/subscription.validator.js

const validateCreateSubscription = (data) => {
  const { planKey } = data;
  const errors = [];

  if (!planKey || planKey.trim().length === 0) {
    errors.push('Plan key is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateSubscription = (data) => {
  const { status } = data;
  const errors = [];

  const validStatuses = ['TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'];
  if (status && !validStatuses.includes(status)) {
    errors.push('Invalid status. Must be one of: TRIAL, ACTIVE, GRACE, EXPIRED, CANCELLED, SUSPENDED');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateSubscription,
  validateUpdateSubscription,
};