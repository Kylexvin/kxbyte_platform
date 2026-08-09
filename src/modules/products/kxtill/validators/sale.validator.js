// src/modules/products/kxtill/validators/sale.validator.js

const validateCreateSale = (data) => {
  const errors = [];

  if (!data.items || data.items.length === 0) {
    errors.push('At least one item is required');
  }

  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item.productId) {
        errors.push(`Item ${i + 1}: Product ID is required`);
      }
      if (!item.unitId) {
        errors.push(`Item ${i + 1}: Unit ID is required`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${i + 1}: Quantity must be greater than 0`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateSale,
};