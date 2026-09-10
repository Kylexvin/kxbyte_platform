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
// FORCE CORS — MUST BE FIRST (BEFORE ANY OTHER MIDDLEWARE)
// ============================================================

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Set CORS headers for ALL requests
  res.setHeader('Access-Control-Allow-Origin', origin || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Total-Count, X-Page');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ============================================================
// ENVIRONMENT VARIABLES FOR CSP
// ============================================================

const AUTH_ORIGIN = process.env.AUTH_BASE_URL || 'http://localhost:5000';
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

// ============================================================
// CUSTOM CSP MIDDLEWARE (BEFORE HELMET)
// ============================================================

app.use((req, res, next) => {
  // Server-rendered auth UI pages (login, register, forgot-password, etc.)
  // need inline style/script support — API/JSON routes don't.
  const isAuthUIPage =
    req.path.startsWith('/api/v1/auth/oauth') ||
    req.path === '/api/v1/auth/register' ||
    req.path === '/api/v1/auth/forgot-password';

  if (isAuthUIPage) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com",
        `form-action 'self' ${AUTH_ORIGIN} ${FRONTEND_ORIGIN}`,
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' ${AUTH_ORIGIN} ${FRONTEND_ORIGIN}`,
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; ')
    );
  } else {
    // Default CSP for all other routes
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: https://res.cloudinary.com https://*.cloudinary.com",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self'",
        `connect-src 'self' ${AUTH_ORIGIN}`,
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; ')
    );
  }
  next();
});

// ============================================================
// STANDARD MIDDLEWARE
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    contentSecurityPolicy: false,
  })
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Minimal Morgan — status + method + path only, skip CORS preflights
app.use(morgan(':status :method :url', {
  skip: (req) => req.method === 'OPTIONS',
}));

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