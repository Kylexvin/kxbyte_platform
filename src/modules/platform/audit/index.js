// src/modules/platform/audit/index.js

import auditRoutes from './routes/audit.routes.js';
import auditService from './services/audit.service.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/audit-logs', auditRoutes);
};

export default {
  register,
  log: auditService.log,
  getAuditEvents: auditService.getAuditEvents,
  getAuditEventById: auditService.getAuditEventById,
  getAuditStats: auditService.getAuditStats,
};