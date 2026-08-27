// src/modules/products/kxtill/services/setting.service.js

import settingDb from '../db/setting.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';

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
    auditLogRetention: settings?.auditLogRetention ?? 90,

    // Branch
    allowBranchSwitch: settings?.allowBranchSwitch ?? true,
  };
};

const updateSettings = async (organizationId, userId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  if (org.ownerId !== userId) {
    throw new Error('Only the organization owner can update store settings');
  }

  const settings = await settingDb.upsertSetting(organizationId, data);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SETTINGS_UPDATED',
    resource: 'store_settings',
    resourceId: settings.id,
    metadata: {
      updatedFields: Object.keys(data),
    },
  });

  return settings;
};

export default {
  getSettings,
  updateSettings,
};