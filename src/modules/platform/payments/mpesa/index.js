// src/modules/platform/payments/mpesa/index.js

import mpesaConfigRoutes from './mpesa.config.routes.js';
import mpesaCallbackRoutes from './mpesa.callback.routes.js';

const MpesaPayments = {
  key: 'mpesa',
  name: 'M-Pesa (Daraja)',

  register: (app) => {
    app.use(
      '/api/v1/organizations/:organizationId/payments/mpesa',
      mpesaConfigRoutes
    );
    app.use('/api/v1/payments/mpesa/callback', mpesaCallbackRoutes);
    console.log('Mounted platform routes: M-Pesa (Daraja)');
  },
};

export default MpesaPayments;