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

const countAuditEvents = async (organizationId) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  return prisma.auditEvent.count({ where });
};

export default {
  createAuditEvent,
  findAuditEvents,
  findAuditEventById,
  countAuditEvents,
};