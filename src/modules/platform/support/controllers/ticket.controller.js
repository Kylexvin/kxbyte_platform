// src/modules/platform/support/controllers/ticket.controller.js

import ticketService from '../services/ticket.service.js';
import ticketValidator from '../validators/ticket.validator.js';

const createTicket = async (req, res) => {
  const validation = ticketValidator.validateCreateTicket(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const ticket = await ticketService.createTicket(userId, organizationId, req.body);
    res.status(201).json({ ticket });
  } catch (error) {
    if (error.message === 'Organization not found' || error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTickets = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { status, priority, categoryId, productKey, limit, offset } = req.query;

    const result = await ticketService.getTickets(userId, organizationId, {
      status,
      priority,
      categoryId,
      productKey,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTicket = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, ticketId } = req.params;
    const ticket = await ticketService.getTicketById(userId, organizationId, ticketId);
    res.status(200).json({ ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this ticket' ||
        error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateTicket = async (req, res) => {
  const validation = ticketValidator.validateUpdateTicket(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, ticketId } = req.params;
    const ticket = await ticketService.updateTicket(userId, organizationId, ticketId, req.body);
    res.status(200).json({ ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this ticket' ||
        error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can update ticket status') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addMessage = async (req, res) => {
  const validation = ticketValidator.validateCreateMessage(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, ticketId } = req.params;
    const { message, isInternal } = req.body;

    const result = await ticketService.addMessage(
      userId,
      organizationId,
      ticketId,
      message,
      isInternal || false
    );

    res.status(201).json({ message: result });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this ticket' ||
        error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  addMessage,
};