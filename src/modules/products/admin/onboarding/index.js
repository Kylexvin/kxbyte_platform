// src/modules/products/admin/onboarding/index.js
//
// Onboarding manifest. Registers the activation hook and exposes routes
// for admin.routes.js.

import onboardingRoutes from './routes/onboarding.routes.js';
import onboardingService from './services/onboarding.service.js';
import { registerActivationHook } from '../../../platform/products/services/product.service.js';

// ============================================================
// ACTIVATION HOOK
// ============================================================
//
// Runs after any product activation succeeds. If the product has an
// onboarding template registered, seed it. Failures are caught by the
// platform's hook dispatcher and logged — never block activation.

const registerOnboardingHook = () => {
  registerActivationHook(async ({ organizationId, productKey }) => {
    await onboardingService.seedForProduct(organizationId, productKey);
  });
};

// ============================================================
// ROUTES
// ============================================================

const registerRoutes = (app) => {
  // Mounted by admin.routes.js at /admin/onboarding — nothing to do here.
  // This function exists so admin/index.js can call it symmetrically.
};

export default {
  registerOnboardingHook,
  registerRoutes,
  routes: onboardingRoutes,
  service: onboardingService,
};