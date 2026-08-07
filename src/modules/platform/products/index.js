// src/modules/platform/products/index.js

import routes from './routes/product.routes.js';
import productService from './services/product.service.js';

const register = (app) => {
  app.use('/api/v1/products', routes);
};

export default {
  register,
  listAllProducts: productService.listAllProducts,
  getProductByKey: productService.getProductByKey,
  getOrganizationProducts: productService.getOrganizationProducts,
  activateProduct: productService.activateProduct,
  deactivateProduct: productService.deactivateProduct,
  getProductActivationStatus: productService.getProductActivationStatus,
};