// src/modules/platform/support/db/ticket.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createTicket = async (data) => {
  return prisma.supportTicket.create({ data });
};

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
      organization: {
        select: {
          id: true,
          name: true,
        },
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

const findTicketsByOrganization = async (organizationId, filters = {}) => {
  const { status, priority, categoryId, productKey, limit = 50, offset = 0 } = filters;
  const where = { organizationId };

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (categoryId) where.categoryId = categoryId;
  if (productKey) where.productKey = productKey;

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
        category: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const findTicketsByUser = async (userId, filters = {}) => {
  const { status, limit = 50, offset = 0 } = filters;
  const where = { userId };

  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        category: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateTicket = async (id, data) => {
  return prisma.supportTicket.update({
    where: { id },
    data,
  });
};

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
  updateTicket,
  createMessage,
  findMessagesByTicket,
};