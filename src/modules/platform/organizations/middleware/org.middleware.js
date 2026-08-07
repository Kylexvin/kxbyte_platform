// src/modules/platform/organizations/middleware/org.middleware.js

const requireOrg = async (req, res, next) => {
  const organizationId = req.headers['x-organization-id'] || req.query.organizationId;
  
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }

  const membership = await orgDb.findMembership(req.user.userId, organizationId);
  if (!membership) {
    return res.status(403).json({ error: 'You do not have access to this organization' });
  }

  req.organizationId = organizationId;
  req.membership = membership;
  next();
};