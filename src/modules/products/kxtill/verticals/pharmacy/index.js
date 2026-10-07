// src/modules/products/kxtill/verticals/pharmacy/index.js
//
// The pharmacy vertical's public surface.
//
// Core (kxtill.routes.js) imports this and wires up:
//   - routes        → mounted under /kxtill/pharmacy
//   - middleware    → gates access by instance
//   - hooks         → called by Core flows (sale, product create, transfer)
//
// Everything else (db, services, constants) stays internal.

import pharmacyRoutes from './routes/pharmacy.routes.js';
import pharmacyMiddleware from './middleware/pharmacy.middleware.js';
import receivingService from './services/receiving.service.js';

const pharmacyVertical = {
  key: 'pharmacy',
  name: 'Pharmacy',

  // Mounted at /api/v1/organizations/:organizationId/kxtill/pharmacy
  routes: pharmacyRoutes,

  // Gates access — every pharmacy route runs through requirePharmacyInstance
  middleware: {
    requireInstance: pharmacyMiddleware.requirePharmacyInstance,
  },

  // Services exposed for internal use by other parts of the app
  // (not exposed over HTTP)
  services: {
    receiving: receivingService,
  },

  // Hooks — Core flows call these when relevant events happen.
  // Added as we build each integration.
  hooks: {
    // onProductCreated:   called when Core creates a KxTillProduct
    // onSaleItemCreated:  called when Core creates a KxTillSaleItem
    // onTransferComplete: called when Core completes a KxTillTransfer
  },
};

export default pharmacyVertical;