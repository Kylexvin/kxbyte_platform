// src/modules/products/kxtill/validators/product.validator.js

// ─── NEW: pharmacy block validation ───
const PHARMACY_STRING_FIELDS = [
  'genericName',
  'brandName',
  'strength',
  'dosageForm',
  'route',
  'prescriptionCategory',
  'packSize',
  'storageConditions',
];

const validatePharmacyBlock = (pharmacy, errors) => {
  if (pharmacy === undefined || pharmacy === null) return;

  if (typeof pharmacy !== 'object' || Array.isArray(pharmacy)) {
    errors.push('pharmacy must be an object');
    return;
  }

  for (const field of PHARMACY_STRING_FIELDS) {
    const val = pharmacy[field];
    if (val === undefined || val === null) continue;
    if (typeof val !== 'string') {
      errors.push(`pharmacy.${field} must be a string`);
    } else if (val.length > 200) {
      errors.push(`pharmacy.${field} must be 200 characters or less`);
    }
  }
};

// ─── Existing validator — now calls the pharmacy helper ───
const validateCreateProduct = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (data.name && data.name.length < 2) {
    errors.push('Product name must be at least 2 characters');
  }

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

  // ─── NEW: validate the optional pharmacy block ───
  validatePharmacyBlock(data.pharmacy, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ─── Existing validator — now calls the pharmacy helper ───
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

  // ─── NEW: validate the optional pharmacy block ───
  validatePharmacyBlock(data.pharmacy, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateProduct,
  validateUpdateProduct,
};