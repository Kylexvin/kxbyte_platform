// src/modules/platform/audit/services/audit.service.js

import auditDb from '../db/audit.db.js';
import orgDb from '../../organizations/db/org.db.js';
import prisma from '../../../../database/postgres/prisma.js';

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
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [total, thisWeek, today, activeUsers] = await Promise.all([
    auditDb.countAuditEvents(organizationId),
    auditDb.countAuditEvents(organizationId, weekStart),
    auditDb.countAuditEvents(organizationId, todayStart),
    // Active users = unique users with events in the last 7 days
    prisma.auditEvent.groupBy({
      by: ['userId'],
      where: {
        organizationId,
        userId: { not: null },
        createdAt: { gte: weekStart },
      },
    }).then((groups) => groups.length),
  ]);

  return { total, thisWeek, today, activeUsers };
};


const exportAuditLogs = async (organizationId, filters = {}) => {
  const logs = await auditDb.exportAuditLogs(organizationId, filters);
  return logs.map((log) => ({
    time: log.createdAt,
    user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
    email: log.user?.email || '',
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: log.metadata ? JSON.stringify(log.metadata) : '',
  }));
};
export default {
  log,
  getAuditEvents,
  getAuditEventById,
  getAuditStats,
  exportAuditLogs,
};