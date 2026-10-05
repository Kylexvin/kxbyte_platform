// src/modules/products/kxtill/services/setting.service.js

import settingDb from '../db/setting.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';

// ============================================================
// ALLOW-LIST — only these keys can be written to the DB
// ============================================================
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

  // Notifications (kept in schema; UI toggles removed until module ships)
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

const pickAllowed = (data) => {
  const out = {};
  for (const key of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key];
    }
  }
  return out;
};

// ============================================================
// GET
// ============================================================
const getSettings = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const settings = await settingDb.findSettingByOrganization(organizationId);
  const org = await orgDb.findOrganizationById(organizationId);

  return {
    // Store info
    shopName: settings?.shopName || org.name,
    shopPhone: settings?.shopPhone || org.phone,
    shopAddress: settings?.shopAddress || org.address,
    shopEmail: settings?.shopEmail || org.email,
    taxNumber: settings?.taxNumber || null,

    // Receipt
    receiptHeader: settings?.receiptHeader || '',
    receiptFooter: settings?.receiptFooter || 'Thank you for shopping!',
    receiptTemplate: settings?.receiptTemplate || 'classic',
    showTax: settings?.showTax ?? false,
    showCustomer: settings?.showCustomer ?? false,
    showCashier: settings?.showCashier ?? true,

    // General
    currency: settings?.currency || org.currency || 'KES',
    timezone: settings?.timezone || org.timezone || 'Africa/Nairobi',
    decimalPlaces: settings?.decimalPlaces ?? 2,
    defaultPaymentMethod: settings?.defaultPaymentMethod || 'CASH',

    // Notifications
    lowStockAlerts: settings?.lowStockAlerts ?? true,
    dailySalesReport: settings?.dailySalesReport ?? false,
    weeklySummary: settings?.weeklySummary ?? true,
    refundNotifications: settings?.refundNotifications ?? true,

    // Security
    sessionTimeout: settings?.sessionTimeout ?? 30,
    requirePinForRefund: settings?.requirePinForRefund ?? true,

    // Branch
    allowBranchSwitch: settings?.allowBranchSwitch ?? true,
  };
};

// ============================================================
// UPDATE
// ============================================================
const updateSettings = async (organizationId, userId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  if (org.ownerId !== userId) {
    throw new Error('Only the organization owner can update store settings');
  }

  // Strip anything not on the allow-list before touching the DB
  const safeData = pickAllowed(data);

  const settings = await settingDb.upsertSetting(organizationId, safeData);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SETTINGS_UPDATED',
    resource: 'store_settings',
    resourceId: settings.id,
    metadata: {
      updatedFields: Object.keys(safeData),
    },
  });

  return settings;
};

export default {
  getSettings,
  updateSettings,
};