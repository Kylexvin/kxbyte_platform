// src/modules/products/kxtill/verticals/pharmacy/middleware/stock-guard.middleware.js
//
// Enforcement: "Direct stock edit is forbidden for pharmacy products."
//
// Prevents the generic Core route
//   PATCH /branches/:branchId/products/:productId/stock
// from silently breaking the pharmacy invariant:
//
//   branchProduct.stock == SUM(batchStock.quantityOnHand)
//
// Allowed stock mutation paths for pharmacy products:
//   ✅ POST /pharmacy/batches/receive     (batch + aggregate)
//   ✅ POST /pharmacy/sales               (batch + aggregate)
//   ⚠️  POST /kxtill/transfers             (aggregate only — pharmacy hook pending)
//   ⚠️  POST /kxtill/sales/:id/refund     (aggregate only — pharmacy hook pending)
//   ⚠️  /pharmacy/stock/adjust            (not yet implemented)
//
// This guard blocks only the DIRECT edit route. Everything else flows through
// services that (will) update batch stock consistently.

import prisma from '../../../../../../database/postgres/prisma.js';

/**
 * Middleware — blocks direct stock edits for pharmacy-tracked products.
 *
 * Expects req.params:
 *   - organizationId
 *   - productId
 *
 * Passes through if:
 *   - The org has no active pharmacy instance, OR
 *   - The product has no pharmacy metadata (not a pharmacy product)
 *
 * Blocks with 403 if:
 *   - The org has an active pharmacy instance AND
 *   - The product has KxTillPharmacyProduct metadata
 */
const blockDirectStockEdit = async (req, res, next) => {
  try {
    const { organizationId, productId } = req.params;

    if (!organizationId || !productId) {
      // Missing params → let downstream handle
      return next();
    }

    // 1. Does the org have an active pharmacy instance?
    const hasPharmacy = await prisma.productInstance.findFirst({
      where: {
        vertical: 'pharmacy',
        isActive: true,
        organizationProduct: {
          organizationId,
          isActive: true,
          product: { key: 'kxtill' },
        },
      },
      select: { id: true },
    });
    if (!hasPharmacy) {
      return next();
    }

    // 2. Is this product pharmacy-tracked?
    const pharmacyProduct = await prisma.kxTillPharmacyProduct.findUnique({
      where: { productId },
      select: { id: true },
    });
    if (!pharmacyProduct) {
      return next();
    }

    // 3. Blocked
    return res.status(403).json({
      error: 'Direct stock edit is disabled for pharmacy products',
      code: 'PHARMACY_STOCK_EDIT_FORBIDDEN',
      hint: 'Use POST /pharmacy/batches/receive to add stock, or /pharmacy/stock/adjust (coming soon) for corrections.',
    });
  } catch (err) {
    console.error('pharmacyStockGuard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  blockDirectStockEdit,
};