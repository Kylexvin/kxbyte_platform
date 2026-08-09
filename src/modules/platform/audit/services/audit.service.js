// src/modules/platform/audit/services/audit.service.js

import auditDb from '../db/audit.db.js';
import orgDb from '../../organizations/db/org.db.js';

const log = async (data) => {
  const {
    organizationId,
    userId,
    action,
    resource,
    resourceId,
    metadata,
    ipAddress,
    userAgent,
  } = data;

  if (organizationId) {
    const organization = await orgDb.findOrganizationById(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
  }

  // ✅ Only validate user if userId is provided
  if (userId) {
    const user = await orgDb.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
  }

  const createData = {
    userId: userId || null,
    action,
    resource,
    resourceId: resourceId || null,
    metadata: metadata || {},
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  };

  if (organizationId) {
    createData.organizationId = organizationId;
  }

  const event = await auditDb.createAuditEvent(createData);
  return event;
};

const getAuditEvents = async (organizationId, filters = {}) => {
  const result = await auditDb.findAuditEvents({
    organizationId,
    ...filters,
  });
  return result;
};

const getAuditEventById = async (eventId) => {
  const event = await auditDb.findAuditEventById(eventId);
  if (!event) {
    throw new Error('Audit event not found');
  }
  return event;
};

const getAuditStats = async (organizationId) => {
  const total = await auditDb.countAuditEvents(organizationId);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recent = await auditDb.findAuditEvents({
    organizationId,
    startDate: sevenDaysAgo,
    limit: 1,
  });

  return {
    total,
    recentCount: recent.total,
  };
};

export default {
  log,
  getAuditEvents,
  getAuditEventById,
  getAuditStats,
};