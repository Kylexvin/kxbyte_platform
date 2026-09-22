// src/modules/platform/subscriptions/controllers/trial.controller.js

import subscriptionService from '../services/subscription.service.js';
import orgDb from '../../organizations/db/org.db.js';

export const getTrialBurns = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const burns = await subscriptionService.getTrialBurnsForOrgOwner(organizationId);
    res.json({ burns });
  } catch (error) {
    console.error('Trial burns fetch error:', error);
    const code = error.message === 'Organization not found' ? 404 : 500;
    res.status(code).json({ error: error.message });
  }
};

export default { getTrialBurns };