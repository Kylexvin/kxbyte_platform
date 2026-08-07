// src/modules/platform/authorization/middleware/permission.middleware.js

import authorizationService from '../services/authorization.service.js';

const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get organizationId from params or body
      const organizationId = req.params.organizationId || req.body.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const hasPermission = await authorizationService.checkPermission(
        userId,
        organizationId,
        permissionKey
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export default {
  requirePermission,
};