// src/modules/platform/branches/controllers/branch-activity.controller.js

import branchActivityService from '../services/branch-activity.service.js';

const getBranchActivity = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { days = 7 } = req.query;

    const result = await branchActivityService.getBranchActivity(
      organizationId,
      userId,
      parseInt(days)
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branch activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getBranchActivity,
};