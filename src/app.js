// src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// ============================================================
// PLATFORM MODULES
// ============================================================

import identity from './modules/platform/identity/index.js';
import organizations from './modules/platform/organizations/index.js';
import products from './modules/platform/products/index.js';
import authorization from './modules/platform/authorization/index.js';
import subscription from './modules/platform/subscriptions/index.js';
import audit from './modules/platform/audit/index.js';
import notifications from './modules/platform/notifications/index.js';
import payment from './modules/platform/payment/index.js';
import branches from './modules/platform/branches/index.js';

// ============================================================
// PRODUCTS
// ============================================================

import productRegistry from './modules/products/index.js';

// ============================================================
// APP INITIALIZATION
// ============================================================

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ============================================================
// MODULE REGISTRATION
// ============================================================

identity.register(app);
organizations.register(app);
products.register(app);
authorization.register(app);
subscription.register(app);
audit.register(app);
notifications.register(app);
payment.register(app);
branches.register(app);

// ============================================================
// KXTILL ROUTE REGISTRATION
// ============================================================

const kxtill = productRegistry.kxtill;
if (kxtill && kxtill.register) {
  kxtill.register(app);
}

// ============================================================
// PRODUCT REGISTRATION
// ============================================================

export async function initializeProducts() {
  for (const [key, product] of Object.entries(productRegistry)) {
    // Register product permissions
    if (product.permissions?.length) {
      await authorization.registerPermissions(key, product.permissions);
      console.log(`✅ Registered ${product.permissions.length} permissions for ${product.name}`);
    }

    // Register product plans
    if (product.subscription?.plans?.length) {
      await subscription.registerPlans(key, product.subscription.plans);
      console.log(`✅ Registered ${product.subscription.plans.length} plans for ${product.name}`);
    }
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});

// ============================================================
// EXPORT
// ============================================================

export default app;