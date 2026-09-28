// src/modules/products/kxtill/controllers/dashboardSync.controller.js

import dashboardSyncService from '../services/dashboardSync.service.js';

const getDashboardSnapshot = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId, period = 'today' } = req.query;

    if (!branchId) {
      return res.status(400).json({ error: 'branchId is required' });
    }

    const snapshot = await dashboardSyncService.getDashboardSnapshot(
      organizationId,
      userId,
      { branchId, period }
    );

    res.status(200).json({
      snapshot,
      version: snapshot.serverTime,
    });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this branch') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Branch ID is required') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Get dashboard snapshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getDashboardSnapshot,
};