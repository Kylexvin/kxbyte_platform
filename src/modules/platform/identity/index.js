// src/modules/platform/identity/index.js

import routes from './routes/auth.routes.js';
import authService from './services/auth.service.js';
import authMiddleware from './middleware/auth.middleware.js';

const register = (app) => {
  app.use('/api/v1/auth', routes);
};

export default {
  register,
  login: authService.login,
  registerUser: authService.register,
  refreshToken: authService.refreshToken,
  logout: authService.logout,
  getMe: authService.getMe,
  authenticate: authMiddleware.authenticate,
  optionalAuth: authMiddleware.optionalAuth,
};