// src/modules/products/kxtill/index.js

import permissions from './permissions.js';

const KxTill = {
  key: 'kxtill',
  name: 'KxTill',
  version: '1.0.0',
  permissions,
  initialize: async ({ organizationId }) => {
    console.log(`[KxTill] Initializing for organization ${organizationId}`);
    return { success: true };
  },
};

export default KxTill;