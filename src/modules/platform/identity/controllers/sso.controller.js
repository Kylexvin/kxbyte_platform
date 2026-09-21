// src/modules/platform/identity/controllers/sso.controller.js
import ssoService from '../services/sso.service.js';

const mintCode = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { target = 'suite' } = req.body || {};
    const result = await ssoService.mintCode(userId, target);
    res.status(200).json(result);
  } catch (error) {
    console.error('SSO mint error:', error);
    const code = error.message === 'User not found or inactive' ? 403 : 500;
    res.status(code).json({ error: error.message });
  }
};

const exchangeCode = async (req, res) => {
  try {
    const { code } = req.body || {};
    const result = await ssoService.exchangeCode(code);
    res.status(200).json(result);
  } catch (error) {
    console.error('SSO exchange error:', error);
    res.status(401).json({ error: error.message });
  }
};

export default { mintCode, exchangeCode };