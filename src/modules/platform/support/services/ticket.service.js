// src/modules/platform/support/services/ticket.service.js

import ticketDb from '../db/ticket.db.js';
import categoryDb from '../db/category.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';
import notifications from '../../notifications/index.js';

const createTicket = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
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

  // Audit log
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
    },
  });

  // Send notification to organization owner
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

  return ticket;
};

const getTickets = async (userId, organizationId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const organization = await orgDb.findOrganizationById(organizationId);
  const isOwner = organization?.ownerId === userId;

  // If owner, see all tickets for organization
  // If member, see only their own tickets
  if (isOwner) {
    return ticketDb.findTicketsByOrganization(organizationId, filters);
  } else {
    return ticketDb.findTicketsByUser(userId, filters);
  }
};

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

  const organization = await orgDb.findOrganizationById(organizationId);
  const isOwner = organization?.ownerId === userId;

  // Owner can view all tickets, members can only view their own
  if (!isOwner && ticket.userId !== userId) {
    throw new Error('You do not have access to this ticket');
  }

  return ticket;
};

const updateTicket = async (userId, organizationId, ticketId, data) => {
  const ticket = await getTicketById(userId, organizationId, ticketId);

  const organization = await orgDb.findOrganizationById(organizationId);
  const isOwner = organization?.ownerId === userId;

  // Only owner can update status/priority
  if (!isOwner) {
    throw new Error('Only the organization owner can update ticket status');
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

const addMessage = async (userId, organizationId, ticketId, message, isInternal = false) => {
  const ticket = await getTicketById(userId, organizationId, ticketId);

  const messageData = {
    ticketId,
    userId,
    message,
    isInternal,
  };

  const newMessage = await ticketDb.createMessage(messageData);

  // Audit log
  await audit.log({
    organizationId,
    userId,
    action: 'SUPPORT_TICKET_MESSAGE_ADDED',
    resource: 'support_message',
    resourceId: newMessage.id,
    metadata: {
      ticketId,
      isInternal,
    },
  });

  // Notify the owner if it's a reply from a member
  const organization = await orgDb.findOrganizationById(organizationId);
  if (organization && organization.ownerId !== userId) {
    await notifications.send({
      userId: organization.ownerId,
      organizationId,
      type: 'SUPPORT_TICKET_REPLY',
      title: `New reply on ticket: ${ticket.title}`,
      message: `A new message was added to ticket "${ticket.title}"`,
      channel: 'IN_APP',
      metadata: {
        ticketId,
        ticketTitle: ticket.title,
      },
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