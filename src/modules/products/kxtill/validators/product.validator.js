// src/modules/products/kxtill/validators/product.validator.js

const validateCreateProduct = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (data.name && data.name.length < 2) {
    errors.push('Product name must be at least 2 characters');
  }

  // Base unit validation
  if (data.baseUnit) {
    if (!data.baseUnit.name || data.baseUnit.name.trim().length === 0) {
      errors.push('Base unit name is required');
    }
    if (!data.baseUnit.abbreviation || data.baseUnit.abbreviation.trim().length === 0) {
      errors.push('Base unit abbreviation is required');
    }
  } else {
    errors.push('Base unit is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateProduct = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name.length < 2) {
    errors.push('Product name must be at least 2 characters');
  }

  if (data.sku !== undefined && data.sku.length > 50) {
    errors.push('SKU must be 50 characters or less');
  }

  if (data.taxRate !== undefined && (data.taxRate < 0 || data.taxRate > 100)) {
    errors.push('Tax rate must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateProduct,
  validateUpdateProduct,
};