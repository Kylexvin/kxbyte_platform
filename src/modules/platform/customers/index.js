// src/modules/platform/customers/index.js

import customerRoutes from './routes/customer.routes.js';
import customerService from './services/customer.service.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/customers', customerRoutes);
};

export default {
  register,
  // Service exports for other modules
  createCustomer: customerService.createCustomer,
  getCustomers: customerService.getCustomers,
  getCustomer: customerService.getCustomer,
  updateCustomer: customerService.updateCustomer,
  deleteCustomer: customerService.deleteCustomer,
  validateCustomer: customerService.validateCustomer,
};