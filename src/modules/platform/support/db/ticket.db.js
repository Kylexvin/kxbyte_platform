// src/modules/platform/support/db/ticket.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// CREATE
// ============================================================

const createTicket = async (data) => {
  return prisma.supportTicket.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      priority: data.priority || 'MEDIUM',
      status: 'OPEN',
      productKey: data.productKey || null,

      // Generic context (branch today, queue/site in KxHelp)
      contextId: data.contextId || null,
      contextType: data.contextType || null,

      // Assignment
      assigneeId: data.assigneeId || null,
    },
  });
};

// ============================================================
// READ
// ============================================================

const findTicketById = async (id) => {
  return prisma.supportTicket.findUnique({
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
      assignee: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      organization: {
        select: { id: true, name: true },
      },
      category: true,
      messages: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
};

// ============================================================
// LIST — everything, scoped to an organization
// ============================================================

const findTicketsByOrganization = async (organizationId, filters = {}) => {
  const {
    status,
    priority,
    categoryId,
    productKey,
    contextId,
    contextType,
    limit = 50,
    offset = 0,
  } = filters;

  const where = { organizationId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (categoryId) where.categoryId = categoryId;
  if (productKey) where.productKey = productKey;
  if (contextId) where.contextId = contextId;
  if (contextType) where.contextType = contextType;

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
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
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, limit, offset };
};

// ============================================================
// LIST — only the caller's own tickets
// ============================================================

const findTicketsByUser = async (userId, filters = {}) => {
  const {
    status,
    priority,
    categoryId,
    productKey,
    contextId,
    contextType,
    limit = 50,
    offset = 0,
  } = filters;

  const where = { userId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (categoryId) where.categoryId = categoryId;
  if (productKey) where.productKey = productKey;
  if (contextId) where.contextId = contextId;
  if (contextType) where.contextType = contextType;

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, limit, offset };
};

// ============================================================
// LIST — scoped by context (e.g. tickets in branches a manager
// belongs to). `contextIds` is an array of contextId values.
// ============================================================

const findTicketsByContexts = async (organizationId, contextIds, filters = {}) => {
  const {
    status,
    priority,
    categoryId,
    productKey,
    contextType,
    limit = 50,
    offset = 0,
  } = filters;

  const where = {
    organizationId,
    contextId: { in: contextIds },
  };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (categoryId) where.categoryId = categoryId;
  if (productKey) where.productKey = productKey;
  if (contextType) where.contextType = contextType;

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
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
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, limit, offset };
};

// ============================================================
// UPDATE
// ============================================================

const updateTicket = async (id, data) => {
  return prisma.supportTicket.update({
    where: { id },
    data,
  });
};

// ============================================================
// MESSAGES
// ============================================================

const createMessage = async (data) => {
  return prisma.supportMessage.create({ data });
};

const findMessagesByTicket = async (ticketId) => {
  return prisma.supportMessage.findMany({
    where: { ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export default {
  createTicket,
  findTicketById,
  findTicketsByOrganization,
  findTicketsByUser,
  findTicketsByContexts,
  updateTicket,
  createMessage,
  findMessagesByTicket,
};