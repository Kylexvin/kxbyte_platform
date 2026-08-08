// src/modules/platform/payment/index.js

import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/payment.webhook.routes.js';
import paymentService from './services/payment.service.js';

const register = (app) => {
  // Authenticated routes
  app.use('/api/v1/organizations/:organizationId/payment', paymentRoutes);
  
  // Webhook/IPN routes — PUBLIC (no auth)
  app.use('/api/v1/payment/webhook', webhookRoutes);
};

export default {
  register,
  
  // Public service methods (for other modules to import)
  initiatePayment: paymentService.initiatePayment,
  getTransactionStatus: paymentService.getTransactionByOrderTrackingId,
  isConfigured: paymentService.isConfigured,
  handleIPN: paymentService.handleIPN,
};