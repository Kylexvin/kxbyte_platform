// src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import passport from './modules/platform/identity/config/passport.config.js';
import platformPermissions from './modules/platform/permissions.js';

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
import support from './modules/platform/support/index.js';

// ============================================================
// PRODUCTS
// ============================================================

import productRegistry from './modules/products/index.js';

// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

const REQUIRED_ENV_VARS = ['SESSION_SECRET'];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// ============================================================
// APP INITIALIZATION
// ============================================================

const app = express();

// ============================================================
// CORS CONFIGURATION
// ============================================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Total-Count', 'X-Page'],
  maxAge: 86400,
};

app.use(cors(corsOptions));

// ============================================================
// STANDARD MIDDLEWARE
// ============================================================

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// ============================================================
// SESSION & PASSPORT
// ============================================================

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

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
support.register(app);

// ============================================================
// KXTILL ROUTE REGISTRATION
// ============================================================

const kxtill = productRegistry.kxtill;
if (kxtill?.register) {
  kxtill.register(app);
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// PRODUCT INITIALIZATION
// ============================================================

export async function initializeProducts() {
  await authorization.registerPermissions('platform', platformPermissions);
  console.log(`Registered ${platformPermissions.length} platform permissions`);

  for (const [key, product] of Object.entries(productRegistry)) {
    if (product.permissions?.length) {
      await authorization.registerPermissions(key, product.permissions);
      console.log(`Registered ${product.permissions.length} permissions for ${product.name}`);
    }

    if (product.subscription?.plans?.length) {
      await subscription.registerPlans(key, product.subscription.plans);
      console.log(`Registered ${product.subscription.plans.length} plans for ${product.name}`);
    }
  }
}

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Hide stack traces in production
  const response = {
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(err.status || 500).json(response);
});

// ============================================================
// EXPORT
// ============================================================

export default app;