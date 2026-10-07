// src/modules/products/kxtill/verticals/pharmacy/middleware/pharmacy.middleware.js
//
// Enforces: "Having kxtill does NOT mean having pharmacy."
//
// Every pharmacy route runs through requirePharmacyInstance. It checks that
// the org has kxtill activated AND has an active pharmacy instance. If not,
// the request is rejected before any pharmacy business logic runs.

import prisma from '../../../../../../database/postgres/prisma.js';

const VERTICAL = 'pharmacy';
const PRODUCT_KEY = 'kxtill';

/**
 * Middleware — asserts the org has an active pharmacy instance.
 * Expects `req.params.organizationId`.
 *
 * Sets `req.pharmacy = { organizationProductId, instanceId, config }` on success
 * so downstream handlers don't re-fetch it.
 */
const requirePharmacyInstance = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.params.orgId;
    if (!organizationId) {
      console.log('[pharmacy middleware] params:', req.params, 'originalUrl:', req.originalUrl);
      return res.status(400).json({ error: 'organizationId is required in URL params' });
    }

    // Find the kxtill product
    const product = await prisma.product.findUnique({
      where: { key: PRODUCT_KEY },
    });
    if (!product) {
      return res.status(404).json({ error: 'kxtill product not found' });
    }

    // Find the org's activation
    const orgProduct = await prisma.organizationProduct.findUnique({
      where: {
        organizationId_productId: {
          organizationId,
          productId: product.id,
        },
      },
    });
    if (!orgProduct || !orgProduct.isActive) {
      return res.status(403).json({
        error: 'kxtill is not activated for this organization',
        code: 'KXTILL_NOT_ACTIVATED',
      });
    }

    // Find an active pharmacy instance for this activation
    const instance = await prisma.productInstance.findFirst({
      where: {
        organizationProductId: orgProduct.id,
        vertical: VERTICAL,
        isActive: true,
      },
      include: {
        pharmacyConfig: true,
      },
    });
    if (!instance) {
      return res.status(403).json({
        error: 'Pharmacy is not enabled for this organization',
        code: 'PHARMACY_NOT_ENABLED',
      });
    }

    // Attach to req so downstream handlers don't re-query
    req.pharmacy = {
      organizationProductId: orgProduct.id,
      instanceId: instance.id,
      instanceName: instance.name,
      config: instance.pharmacyConfig ?? null,
    };

    return next();
  } catch (err) {
    console.error('requirePharmacyInstance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  requirePharmacyInstance,
};