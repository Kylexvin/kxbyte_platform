// src/modules/platform/support/services/ticket.service.js

import ticketDb from '../db/ticket.db.js';
import categoryDb from '../db/category.db.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import audit from '../../audit/index.js';
import notifications from '../../notifications/index.js';
import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// HELPERS
// ============================================================

const checkPermission = async (userId, organizationId, key) => {
  return authorizationService.checkPermission(userId, organizationId, key);
};

/**
 * Returns the contextIds (branch ids) a user has access to via
 * their branch assignments. Owners bypass this — they always
 * have all-branches access via `*`.
 */
const getUserContextIds = async (userId, organizationId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) return [];

  // Owner or hasAllBranches → treat as "all"
  const organization = await orgDb.findOrganizationById(organizationId);
  if (organization && organization.ownerId === userId) return null;
  if (membership.hasAllBranches) return null;

  const assignments = await prisma.branchAssignment.findMany({
    where: { membershipId: membership.id },
    select: { branchId: true },
  });

  return assignments.map((a) => a.branchId);
};

// ============================================================
// CREATE TICKET
// ============================================================

const createTicket = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) throw new Error('Organization not found');

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
  if (!category) throw new Error('Category not found');

  const ticket = await ticketDb.createTicket({
    organizationId,
    userId,
    categoryId: data.categoryId,
    title: data.title,
    description: data.description,
    priority: data.priority || 'MEDIUM',
    status: 'OPEN',
    productKey: data.productKey || null,
    contextId: data.contextId || null,
    contextType: data.contextType || 'branch',
    assigneeId: data.assigneeId || null,
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
      contextId: ticket.contextId,
      contextType: ticket.contextType,
    },
  });

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
// LIST TICKETS — permission + context scoped
// ============================================================
// Priority of scope (first match wins):
//   1. support.tickets.view.all → every ticket in the org
//   2. support.tickets.manage   → tickets in the caller's contexts
//                                 (branches) OR tickets the caller created
//   3. support.tickets.view     → tickets the caller created
//   4. none                     → empty (also used for "own only")

const getTickets = async (userId, organizationId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasViewAll = await checkPermission(
    userId,
    organizationId,
    'support.tickets.view.all'
  );

  if (hasViewAll) {
    return ticketDb.findTicketsByOrganization(organizationId, filters);
  }

  const hasManage = await checkPermission(
    userId,
    organizationId,
    'support.tickets.manage'
  );

  if (hasManage) {
    const contextIds = await getUserContextIds(userId, organizationId);

    // null means "all contexts" — treat as owner-level list
    if (contextIds === null) {
      return ticketDb.findTicketsByOrganization(organizationId, filters);
    }

    // No branch assignments → fall back to own tickets
    if (contextIds.length === 0) {
      return ticketDb.findTicketsByUser(userId, filters);
    }

    return ticketDb.findTicketsByContexts(organizationId, contextIds, filters);
  }

  // Everyone else: only their own
  return ticketDb.findTicketsByUser(userId, filters);
};

// ============================================================
// GET ONE TICKET
// ============================================================
// Access rules:
//   - Author always can read their own ticket
//   - Assignee can read
//   - view.all → can read any ticket in the org
//   - manage + ticket's contextId is in caller's contexts → can read
//   - else → 403

const getTicketById = async (userId, organizationId, ticketId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const ticket = await ticketDb.findTicketById(ticketId);
  if (!ticket) throw new Error('Ticket not found');

  if (ticket.organizationId !== organizationId) {
    throw new Error('You do not have access to this ticket');
  }

  // Author
  if (ticket.userId === userId) return ticket;

  // Assignee
  if (ticket.assigneeId === userId) return ticket;

  // view.all
  const hasViewAll = await checkPermission(
    userId,
    organizationId,
    'support.tickets.view.all'
  );
  if (hasViewAll) return ticket;

  // manage + context match
  const hasManage = await checkPermission(
    userId,
    organizationId,
    'support.tickets.manage'
  );
  if (hasManage) {
    const contextIds = await getUserContextIds(userId, organizationId);

    if (contextIds === null) return ticket;
    if (
      ticket.contextId &&
      contextIds.includes(ticket.contextId)
    ) {
      return ticket;
    }
  }

  throw new Error('You do not have access to this ticket');
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

  // Whitelist fields
  const updateData = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = userId;
    }
    if (data.status === 'CLOSED') {
      updateData.closedAt = new Date();
    }
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
  if (data.resolutionNote !== undefined) {
    updateData.resolutionNote = data.resolutionNote;
  }

  const updated = await ticketDb.updateTicket(ticketId, updateData);

  await audit.log({
    organizationId,
    userId,
    action: 'SUPPORT_TICKET_UPDATED',
    resource: 'support_ticket',
    resourceId: ticketId,
    metadata: {
      updatedFields: Object.keys(updateData),
      status: updateData.status,
      priority: updateData.priority,
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

  // Notify the reporter if someone else replied
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

  // Notify the owner if the reply came from someone else, and
  // the owner isn't already the reporter
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