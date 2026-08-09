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
    shopName: settings?.shopName || org.name,
    shopPhone: settings?.shopPhone || org.phone,
    shopAddress: settings?.shopAddress || org.address,
    shopEmail: settings?.shopEmail || org.email,
    taxNumber: settings?.taxNumber || null,
    receiptFooter: settings?.receiptFooter || 'Thank you for shopping!',
    receiptHeader: settings?.receiptHeader || '',
    showTax: settings?.showTax || false,
    showCustomer: settings?.showCustomer || false,
  };
};

const updateSettings = async (organizationId, userId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Check if user has permission (owner or manager)
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