// src/modules/products/kxtill/controllers/setting.controller.js

import settingService from '../services/setting.service.js';
import settingValidator from '../validators/setting.validator.js';

const getSettings = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const settings = await settingService.getSettings(organizationId, userId);
    res.status(200).json({ settings });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSettings = async (req, res) => {
  const validation = settingValidator.validateUpdateSettings(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const settings = await settingService.updateSettings(organizationId, userId, req.body);
    res.status(200).json({ settings });
  } catch (error) {
    if (error.message === 'Only the organization owner can update store settings') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getSettings,
  updateSettings,
};