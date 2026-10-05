// src/modules/products/kxtill/controllers/onboarding.controller.js

import onboardingService from '../services/onboarding.service.js';

const getState = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const state = await onboardingService.getOnboardingState(
      organizationId,
      userId
    );
    res.status(200).json(state);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get onboarding state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const dismiss = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await onboardingService.dismissOnboarding(
      organizationId,
      userId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can dismiss onboarding') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Dismiss onboarding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getState,
  dismiss,
};