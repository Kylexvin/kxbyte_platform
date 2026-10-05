// src/modules/products/kxtill/validators/setting.validator.js

// Fields the client is allowed to update. Anything else is silently dropped.
const UPDATABLE_FIELDS = [
  // Store info
  'shopName',
  'shopPhone',
  'shopEmail',
  'shopAddress',
  'taxNumber',

  // Receipt
  'receiptHeader',
  'receiptFooter',
  'receiptTemplate',
  'showTax',
  'showCustomer',
  'showCashier',

  // General
  'currency',
  'timezone',
  'decimalPlaces',
  'defaultPaymentMethod',

  // Notifications (kept in schema — will be used when notification module ships)
  'lowStockAlerts',
  'dailySalesReport',
  'weeklySummary',
  'refundNotifications',

  // Security (dummy — kept in schema, not surfaced in UI)
  'sessionTimeout',
  'requirePinForRefund',

  // Branch
  'allowBranchSwitch',
];

const ALLOWED_CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'];
const ALLOWED_TEMPLATES = ['classic', 'modern', 'minimal'];
const ALLOWED_PAYMENT_METHODS = ['CASH', 'MPESA', 'CARD'];

const validateUpdateSettings = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Invalid payload'] };
  }

  // Reject any unknown key — this is the important part
  const unknownKeys = Object.keys(data).filter(
    (k) => !UPDATABLE_FIELDS.includes(k)
  );
  if (unknownKeys.length > 0) {
    errors.push(`Unknown fields: ${unknownKeys.join(', ')}`);
  }

  // Store info
  if (data.shopPhone != null && data.shopPhone !== '') {
    if (typeof data.shopPhone !== 'string' || data.shopPhone.length < 10) {
      errors.push('Phone number must be at least 10 digits');
    }
  }

  if (data.shopEmail != null && data.shopEmail !== '') {
    if (typeof data.shopEmail !== 'string' || !data.shopEmail.includes('@')) {
      errors.push('Invalid email address');
    }
  }

  if (data.taxNumber != null && data.taxNumber !== '') {
    if (typeof data.taxNumber !== 'string' || data.taxNumber.length < 5) {
      errors.push('Tax number must be at least 5 characters');
    }
  }

  // Receipt
  if (data.receiptTemplate != null) {
    if (!ALLOWED_TEMPLATES.includes(data.receiptTemplate)) {
      errors.push(`Template must be one of: ${ALLOWED_TEMPLATES.join(', ')}`);
    }
  }

  // General
  if (data.decimalPlaces != null) {
    if (![0, 1, 2].includes(data.decimalPlaces)) {
      errors.push('Decimal places must be 0, 1, or 2');
    }
  }

  if (data.currency != null) {
    if (!ALLOWED_CURRENCIES.includes(data.currency)) {
      errors.push(`Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`);
    }
  }

  if (data.defaultPaymentMethod != null) {
    if (!ALLOWED_PAYMENT_METHODS.includes(data.defaultPaymentMethod)) {
      errors.push(
        `Default payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
      );
    }
  }

  // Security
  if (data.sessionTimeout != null) {
    if (
      typeof data.sessionTimeout !== 'number' ||
      data.sessionTimeout < 5 ||
      data.sessionTimeout > 120
    ) {
      errors.push('Session timeout must be between 5 and 120 minutes');
    }
  }

  // Booleans — ensure they're actually booleans if present
  const booleanFields = [
    'showTax',
    'showCustomer',
    'showCashier',
    'lowStockAlerts',
    'dailySalesReport',
    'weeklySummary',
    'refundNotifications',
    'requirePinForRefund',
    'allowBranchSwitch',
  ];
  for (const key of booleanFields) {
    if (data[key] != null && typeof data[key] !== 'boolean') {
      errors.push(`${key} must be a boolean`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};


export { UPDATABLE_FIELDS };

export default {
  validateUpdateSettings,
  UPDATABLE_FIELDS,
};