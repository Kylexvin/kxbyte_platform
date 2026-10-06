// src/modules/platform/products/validators/product.validator.js

const validateActivateProduct = (data) => {
  const { productKey, vertical } = data;
  const errors = [];

  if (!productKey || productKey.trim().length === 0) {
    errors.push('Product key is required');
  }

  if (vertical !== undefined) {
    if (typeof vertical !== 'string' || vertical.trim().length === 0) {
      errors.push('Vertical must be a non-empty string');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateActivateProduct,
};