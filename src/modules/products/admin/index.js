// src/modules/products/admin/index.js
import permissions from './permissions.js';
import adminRoutes from './routes/admin.routes.js';

const KxByteAdmin = {
  key: 'admin',
  name: 'KxByte Admin',
  version: '1.0.0',
  permissions,

  register: (app) => {
    app.use('/api/v1/admin', adminRoutes);
  },
};

export default KxByteAdmin;