// src/modules/products/kxtill/transfer/validators/transfer.validator.js

const validateCreateTransfer = (data) => {
  const errors = [];

  if (!data.sourceBranchProductId) {
    errors.push('Source branch product is required');
  }

  if (!data.destBranchId) {
    errors.push('Destination branch is required');
  }

  if (!data.quantitySent || data.quantitySent <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateTransfer = (data) => {
  const errors = [];

  if (data.status && !['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'FAILED'].includes(data.status)) {
    errors.push('Invalid status');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateTransfer,
  validateUpdateTransfer,
};