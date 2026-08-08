// src/modules/products/kxtill/index.js

import permissions from './permissions.js';

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
};

export default KxTill;