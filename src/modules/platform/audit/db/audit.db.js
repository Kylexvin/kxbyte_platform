// src/modules/platform/audit/db/audit.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createAuditEvent = async (data) => {
  const createData = {
    userId: data.userId,
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId || null,
    metadata: data.metadata || {},
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
  };

  if (data.organizationId) {
    createData.organizationId = data.organizationId;
  }

  return prisma.auditEvent.create({
    data: createData,
  });
};

const findAuditEvents = async (filters = {}) => {
  const {
    organizationId,
    userId,
    action,
    resource,
    resourceId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filters;

  const where = {};

  if (organizationId) where.organizationId = organizationId;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (resourceId) where.resourceId = resourceId;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const findAuditEventById = async (id) => {
  return prisma.auditEvent.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

const countAuditEvents = async (organizationId, since = null) => {
  const where = { organizationId };
  if (since) where.createdAt = { gte: since };
  return prisma.auditEvent.count({ where });
};

const getAuditStats = async (organizationId) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [total, thisWeek, today, activeUsers] = await Promise.all([
    prisma.auditEvent.count({ where: { organizationId } }),
    prisma.auditEvent.count({
      where: {
        organizationId,
        createdAt: { gte: weekStart },
      },
    }),
    prisma.auditEvent.count({
      where: {
        organizationId,
        createdAt: { gte: todayStart },
      },
    }),
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
  const { startDate, endDate, action, userId, search } = filters;
  const where = { organizationId };

  if (startDate) where.createdAt = { gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (userId) where.userId = userId;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { resource: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return prisma.auditEvent.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export default {
  createAuditEvent,
  findAuditEvents,
  findAuditEventById,
  countAuditEvents,
  getAuditStats,
  exportAuditLogs,
};