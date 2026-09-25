// src/modules/platform/support/services/ticket.service.js

import ticketDb from '../db/ticket.db.js';
import categoryDb from '../db/category.db.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import audit from '../../audit/index.js';
import notifications from '../../notifications/index.js';

// ============================================================
// HELPERS
// ============================================================

const checkPermission = async (userId, organizationId, key) => {
  return authorizationService.checkPermission(userId, organizationId, key);
};

// ============================================================
// CREATE TICKET
// ============================================================

const createTicket = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasCreate = await checkPermission(
    userId,
    organizationId,
    'support.tickets.create'
  );
  if (!hasCreate) {
    throw new Error('You do not have permission to create tickets');
  }

  const category = await categoryDb.findCategoryById(data.categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  const ticket = await ticketDb.createTicket({
    organizationId,
    userId,
    categoryId: data.categoryId,
    title: data.title,
    description: data.description,
    priority: data.priority || 'MEDIUM',
    status: 'OPEN',
    productKey: data.productKey || null,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'SUPPORT_TICKET_CREATED',
    resource: 'support_ticket',
    resourceId: ticket.id,
    metadata: {
      title: ticket.title,
      category: category.name,
      priority: ticket.priority,
      productKey: ticket.productKey,
    },
  });

  // Notify the org owner (unless they created it themselves)
  if (organization.ownerId !== userId) {
    const owner = await orgDb.findUserById(organization.ownerId);
    if (owner) {
      await notifications.send({
        userId: owner.id,
        organizationId,
        type: 'SUPPORT_TICKET_NEW',
        title: `New Support Ticket: ${ticket.title}`,
        message: `${membership.user?.firstName || 'A member'} created a ticket: ${ticket.title}`,
        channel: 'IN_APP',
        metadata: {
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          createdBy: membership.userId,
        },
      });
    }
  }

  return ticket;
};

// ============================================================
// LIST TICKETS
// ============================================================
// Members with `support.tickets.view` see all org tickets.
// Everyone else sees only their own.

const getTickets = async (userId, organizationId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasViewAll = await checkPermission(
    userId,
    organizationId,
    'support.tickets.view'
  );

  if (hasViewAll) {
    return ticketDb.findTicketsByOrganization(organizationId, filters);
  }

  return ticketDb.findTicketsByUser(userId, filters);
};

// ============================================================
// GET ONE TICKET
// ============================================================

const getTicketById = async (userId, organizationId, ticketId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const ticket = await ticketDb.findTicketById(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.organizationId !== organizationId) {
    throw new Error('You do not have access to this ticket');
  }

  // Author always has access.
  if (ticket.userId === userId) return ticket;

  // Otherwise, needs view permission.
  const hasViewAll = await checkPermission(
    userId,
    organizationId,
    'support.tickets.view'
  );
  if (!hasViewAll) {
    throw new Error('You do not have access to this ticket');
  }

  return ticket;
};

// ============================================================
// UPDATE TICKET
// ============================================================

const updateTicket = async (userId, organizationId, ticketId, data) => {
  await getTicketById(userId, organizationId, ticketId);

  const hasManage = await checkPermission(
    userId,
    organizationId,
    'support.tickets.manage'
  );
  if (!hasManage) {
    throw new Error('You do not have permission to update tickets');
  }

  const updated = await ticketDb.updateTicket(ticketId, data);

  await audit.log({
    organizationId,
    userId,
    action: 'SUPPORT_TICKET_UPDATED',
    resource: 'support_ticket',
    resourceId: ticketId,
    metadata: {
      updatedFields: Object.keys(data),
      status: data.status,
      priority: data.priority,
    },
  });

  return updated;
};

// ============================================================
// ADD MESSAGE
// ============================================================

const addMessage = async (
  userId,
  organizationId,
  ticketId,
  message,
  isInternal = false
) => {
  const ticket = await getTicketById(userId, organizationId, ticketId);

  // Internal notes require manage permission.
  if (isInternal) {
    const hasManage = await checkPermission(
      userId,
      organizationId,
      'support.tickets.manage'
    );
    if (!hasManage) {
      throw new Error('You do not have permission to add internal notes');
    }
  }

  const newMessage = await ticketDb.createMessage({
    ticketId,
    userId,
    message,
    isInternal,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'SUPPORT_TICKET_MESSAGE_ADDED',
    resource: 'support_message',
    resourceId: newMessage.id,
    metadata: { ticketId, isInternal },
  });

  // Notify ticket author when someone else replies.
  if (ticket.userId !== userId) {
    await notifications.send({
      userId: ticket.userId,
      organizationId,
      type: 'SUPPORT_TICKET_REPLY',
      title: `New reply on ticket: ${ticket.title}`,
      message: `A new message was added to ticket "${ticket.title}"`,
      channel: 'IN_APP',
      metadata: { ticketId, ticketTitle: ticket.title },
    });
  }

  // Also notify the org owner if the reply came from someone else.
  const organization = await orgDb.findOrganizationById(organizationId);
  if (
    organization &&
    organization.ownerId !== userId &&
    organization.ownerId !== ticket.userId
  ) {
    await notifications.send({
      userId: organization.ownerId,
      organizationId,
      type: 'SUPPORT_TICKET_REPLY',
      title: `New reply on ticket: ${ticket.title}`,
      message: `A new message was added to ticket "${ticket.title}"`,
      channel: 'IN_APP',
      metadata: { ticketId, ticketTitle: ticket.title },
    });
  }

  return newMessage;
};

export default {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  addMessage,
};