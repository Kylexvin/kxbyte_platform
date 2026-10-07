// src/modules/products/kxtill/verticals/pharmacy/validators/pharmacy.validator.js
//
// Shape validation for pharmacy endpoints. Runs BEFORE the controller touches
// the service. Business rules (branch product existence, etc.) live in services.

const isValidUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isValidDate = (v) => {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

/**
 * Validate POST /pharmacy/batches/receive payload.
 *
 * Expected body:
 * {
 *   productId:    uuid,
 *   branchId:     uuid,
 *   batchNumber:  string,
 *   expiryDate:   ISO date string,
 *   quantityBase: number > 0,
 *   unitCost:     number >= 0,
 *   sellingPrice: number >= 0 | optional,
 *   manufacturedAt: ISO date | optional,
 *   manufacturer:   string | optional,
 *   reason:         string | optional
 * }
 */
const validateReceiveBatch = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Body must be a JSON object'] };
  }

  const {
    productId,
    branchId,
    batchNumber,
    expiryDate,
    quantityBase,
    unitCost,
    sellingPrice,
    manufacturedAt,
    manufacturer,
    reason,
  } = data;

  // Required IDs
  if (!isValidUuid(productId)) errors.push('productId must be a valid UUID');
  if (!isValidUuid(branchId)) errors.push('branchId must be a valid UUID');

  // Batch identity
  if (!batchNumber || typeof batchNumber !== 'string' || batchNumber.trim().length === 0) {
    errors.push('batchNumber is required and must be a non-empty string');
  } else if (batchNumber.trim().length > 100) {
    errors.push('batchNumber must be 100 characters or fewer');
  }

  // Expiry
  if (!isValidDate(expiryDate)) {
    errors.push('expiryDate must be a valid date');
  }

  // Quantity
  if (quantityBase == null || Number.isNaN(Number(quantityBase))) {
    errors.push('quantityBase is required and must be a number');
  } else if (Number(quantityBase) <= 0) {
    errors.push('quantityBase must be greater than 0');
  }

  // Cost
  if (unitCost == null || Number.isNaN(Number(unitCost))) {
    errors.push('unitCost is required and must be a number');
  } else if (Number(unitCost) < 0) {
    errors.push('unitCost must be zero or greater');
  }

  // Optional selling price
  if (sellingPrice != null) {
    if (Number.isNaN(Number(sellingPrice))) {
      errors.push('sellingPrice must be a number');
    } else if (Number(sellingPrice) < 0) {
      errors.push('sellingPrice must be zero or greater');
    }
  }

  // Optional manufactured date
  if (manufacturedAt != null && !isValidDate(manufacturedAt)) {
    errors.push('manufacturedAt must be a valid date');
  }

  // Optional strings
  if (manufacturer != null && typeof manufacturer !== 'string') {
    errors.push('manufacturer must be a string');
  }
  if (reason != null && typeof reason !== 'string') {
    errors.push('reason must be a string');
  }

  return { valid: errors.length === 0, errors };
};

export default {
  validateReceiveBatch,
};