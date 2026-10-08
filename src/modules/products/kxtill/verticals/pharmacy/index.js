import pharmacyRoutes from './routes/pharmacy.routes.js';
import pharmacyMiddleware from './middleware/pharmacy.middleware.js';
import stockGuard from './middleware/stock-guard.middleware.js';
import receivingService from './services/receiving.service.js';

const pharmacyVertical = {
  key: 'pharmacy',
  name: 'Pharmacy',

  routes: pharmacyRoutes,

  middleware: {
    requireInstance: pharmacyMiddleware.requirePharmacyInstance,
    blockDirectStockEdit: stockGuard.blockDirectStockEdit,
  },

  services: {
    receiving: receivingService,
  },

  hooks: {},
};

export default pharmacyVertical;