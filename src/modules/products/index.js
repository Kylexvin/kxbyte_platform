// src/modules/products/index.js

import admin from './admin/index.js';
import KxTill from './kxtill/index.js';
import kxcrm from './kxcrm/index.js';

const products = {
  admin: admin,
  kxtill: KxTill,
  kxcrm,
};

export default products;