// src/modules/products/kxtill/controllers/branch.controller.js

import branchService from '../services/branch.service.js';

const getBranches = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await branchService.getBranchStats(organizationId, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranchOverview = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, branchId } = req.params;
    const result = await branchService.getBranchOverview(
      organizationId,
      userId,
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Branch not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get branch overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getBranches,
  getBranchOverview,
};