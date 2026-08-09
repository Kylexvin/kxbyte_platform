// src/modules/products/kxtill/index.js

import permissions from './permissions.js';
import kxtillRoutes from './routes/kxtill.routes.js';
import productService from './services/product.service.js';

const KxTill = {
  key: 'kxtill',
  name: 'KxTill',
  version: '1.0.0',
  
  permissions,

  subscription: {
    trialDays: 21,
    plans: [
      {
        key: 'professional',
        name: 'Professional',
        price: 699,
        currency: 'KES',
        interval: 'MONTHLY',
        features: ['sales', 'inventory', 'customers', 'reports'],
        limits: {
          users: 5,
          products: 5000,
        },
      },
      {
        key: 'business',
        name: 'Business',
        price: 999,
        currency: 'KES',
        interval: 'MONTHLY',
        features: ['sales', 'inventory', 'customers', 'reports', 'advanced_reports', 'api'],
        limits: {
          users: 20,
          products: 50000,
        },
      },
    ],
  },

  initialize: async ({ organizationId }) => {
    console.log(`[KxTill] Initializing for organization ${organizationId}`);
    return { success: true };
  },

  // Routes registration
  register: (app) => {
    app.use('/api/v1/organizations/:organizationId/kxtill', kxtillRoutes);
  },

  // Service exports for other modules
  productService,
};

export default KxTill;