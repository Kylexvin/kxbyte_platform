// src/modules/platform/authorization/index.js

import roleRoutes from './routes/role.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import permissionService from './services/permission.service.js';
import authorizationService from './services/authorization.service.js';
import permissionMiddleware from './middleware/permission.middleware.js';

const register = (app) => {
  app.use('/api/v1/organizations/:organizationId/roles', roleRoutes);
  app.use('/api/v1/permissions', permissionRoutes);  
};

export default {
  register,
  registerPermissions: permissionService.registerPermissions,
  listAllPermissions: permissionService.listAllPermissions,
  listPermissionsByProduct: permissionService.listPermissionsByProduct,
  getPermissionByKey: permissionService.getPermissionByKey,
  checkPermission: authorizationService.checkPermission,
  checkPermissions: authorizationService.checkPermissions,
  requirePermission: permissionMiddleware.requirePermission,
};