// src/modules/products/admin/middleware/requirePlatformAdmin.middleware.js
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

export const requirePlatformAdmin = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Delegate to authorization service — it knows about platform admin bypass
      const allowed = await authorizationService.isPlatformAdmin(userId);
      if (!allowed) {
        return res.status(403).json({ error: 'Not a platform admin' });
      }

      req.platformAdmin = { userId };
      next();
    } catch (err) {
      console.error('requirePlatformAdmin error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};