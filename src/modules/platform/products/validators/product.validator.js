// src/modules/platform/products/validators/product.validator.js

const validateActivateProduct = (data) => {
  const { productKey } = data;
  const errors = [];

  if (!productKey || productKey.trim().length === 0) {
    errors.push('Product key is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateActivateProduct,
};