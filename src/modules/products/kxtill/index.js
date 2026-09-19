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
  plans: [
    {
      key: 'standard',
      name: 'Standard',
      price: 0,
      currency: 'KES',
      interval: 'MONTHLY',
      trialDays: 14,
      features: [],
      limits: null,
    },
  ],
},

  initialize: async ({ organizationId }) => {
    console.log(`[KxTill] Initializing for organization ${organizationId}`);
    return { success: true };
  },

  register: (app) => {
    app.use('/api/v1/organizations/:organizationId/kxtill', kxtillRoutes);
  },

  productService,
};

export default KxTill;