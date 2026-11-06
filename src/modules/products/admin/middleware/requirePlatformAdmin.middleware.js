// src/modules/products/admin/middleware/requirePlatformAdmin.middleware.js
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import orgDb from '../../../platform/organizations/db/org.db.js';

const KXBYTE_SLUG = 'kxbyte';

export const requirePlatformAdmin = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const internalOrg = await orgDb.findOrganizationBySlug(KXBYTE_SLUG);
      if (!internalOrg) {
        return res.status(500).json({ error: 'Internal organization not configured' });
      }

      const membership = await orgDb.findMembership(userId, internalOrg.id);
      if (!membership || !membership.isActive) {
        return res.status(403).json({ error: 'Not a platform staff member' });
      }

      if (permissionKey) {
        const allowed = await authorizationService.checkPermission(
          userId,
          internalOrg.id,
          permissionKey
        );
        if (!allowed) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      }

      req.platformAdmin = { userId, organizationId: internalOrg.id };
      req.internalOrgId = internalOrg.id;
      next();
    } catch (err) {
      console.error('requirePlatformAdmin error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};