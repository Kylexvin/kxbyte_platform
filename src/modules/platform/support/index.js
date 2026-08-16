// src/modules/platform/support/index.js

import supportRoutes from './routes/support.routes.js';
import ticketService from './services/ticket.service.js';
import categoryService from './services/category.service.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/support', supportRoutes);
};

export default {
  register,
  // Service exports for other modules
  createTicket: ticketService.createTicket,
  getTickets: ticketService.getTickets,
  getTicketById: ticketService.getTicketById,
  updateTicket: ticketService.updateTicket,
  addMessage: ticketService.addMessage,
  getAllCategories: categoryService.getAllCategories,
};