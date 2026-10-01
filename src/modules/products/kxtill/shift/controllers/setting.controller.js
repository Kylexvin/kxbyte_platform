// src/modules/products/kxtill/shift/controllers/setting.controller.js

import settingService from '../services/setting.service.js';

const mapError = (res, error, fallbackMessage = 'Internal server error') => {
  const msg = error.message || '';

  if (
    msg === 'Organization not found' ||
    msg === 'Branch not found'
  ) {
    return res.status(404).json({ error: msg });
  }

  if (
    msg === 'You do not have access to this organization' ||
    msg === 'You do not have permission to manage shift settings'
  ) {
    return res.status(403).json({ error: msg });
  }

  console.error('Setting controller error:', error);
  return res.status(500).json({ error: fallbackMessage });
};

const getSetting = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;
    const setting = await settingService.getSetting(organizationId, userId, branchId);
    return res.status(200).json({ setting });
  } catch (error) {
    return mapError(res, error, 'Failed to fetch shift setting');
  }
};

const updateSetting = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId, branchId } = req.params;
    const setting = await settingService.updateSetting(organizationId, userId, branchId, req.body);
    return res.status(200).json({ setting });
  } catch (error) {
    return mapError(res, error, 'Failed to update shift setting');
  }
};

export default {
  getSetting,
  updateSetting,
};