// src/modules/platform/support/routes/support.routes.js

import express from 'express';
import ticketController from '../controllers/ticket.controller.js';
import categoryController from '../controllers/category.controller.js';
import authMiddleware from '../../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Ticket routes
router.post('/tickets', ticketController.createTicket);
router.get('/tickets', ticketController.getTickets);
router.get('/tickets/:ticketId', ticketController.getTicket);
router.patch('/tickets/:ticketId', ticketController.updateTicket);
router.post('/tickets/:ticketId/messages', ticketController.addMessage);

// Category routes (public to authenticated users)
router.get('/categories', categoryController.getAllCategories);
router.get('/categories/:id', categoryController.getCategory);

// Admin category management (future)
// router.post('/categories', categoryController.createCategory);
// router.patch('/categories/:id', categoryController.updateCategory);
// router.delete('/categories/:id', categoryController.deleteCategory);

export default router;