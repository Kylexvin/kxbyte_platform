// src/modules/products/kxtill/verticals/pharmacy/services/batches.service.js
//
// Read-only services for pharmacy batches.
// Normalizes DB rows into clean shapes for the API.

import prisma from '../../../../../../database/postgres/prisma.js';
import pharmacyDb from '../db/pharmacy.db.js';

/**
 * Normalize a batch row + its stock layers into a consistent API shape.
 */
const shapeBatch = (row) => ({
  id: row.id,
  batchNumber: row.batchNumber,
  expiryDate: row.expiryDate,
  manufacturedAt: row.manufacturedAt,
  manufacturer: row.manufacturer,
  product: row.product
    ? { id: row.product.id, name: row.product.name, sku: row.product.sku }
    : undefined,
  stocks: (row.stocks || []).map((s) => ({
    id: s.id,
    branchProductId: s.branchProductId,
    branchId: s.branchProduct?.branchId ?? null,
    quantityOnHand: Number(s.quantityOnHand),
    unitCost: Number(s.unitCost),
    sellingPrice: s.sellingPrice != null ? Number(s.sellingPrice) : null,
    status: s.status,
  })),
});

/**
 * GET /pharmacy/batches
 * List batches for an org, optional branch filter.
 */
const listBatches = async ({ organizationId, branchId, take = 100, skip = 0 }) => {
  if (!organizationId) throw new Error('organizationId is required');

  const rows = await pharmacyDb.listBatches({
    organizationId,
    branchId: branchId || null,
    take,
    skip,
  });

  return {
    count: rows.length,
    batches: rows.map(shapeBatch),
  };
};

/**
 * GET /pharmacy/batches/expiring
 * Batches expiring within N days.
 */
const listExpiring = async ({ organizationId, branchId, days = 90 }) => {
  if (!organizationId) throw new Error('organizationId is required');
  if (!Number.isFinite(days) || days < 1) {
    throw new Error('days must be a positive number');
  }

  const rows = await pharmacyDb.listExpiringBatches({
    organizationId,
    branchId: branchId || null,
    days: Number(days),
  });

  return {
    count: rows.length,
    days: Number(days),
    batches: rows.map(shapeBatch),
  };
};

/**
 * GET /pharmacy/products/:productId/batches
 * Batches for a single product, FEFO-ordered.
 */
const listForProduct = async ({ organizationId, productId, branchId }) => {
  if (!organizationId) throw new Error('organizationId is required');
  if (!productId) throw new Error('productId is required');

  // Confirm the product belongs to the org (light security check)
  const product = await prisma.kxTillProduct.findFirst({
    where: { id: productId, organizationId },
    select: { id: true, name: true, sku: true },
  });
  if (!product) {
    throw new Error('Product not found in this organization');
  }

  const rows = await pharmacyDb.listBatchesForProduct({
    productId,
    branchId: branchId || null,
  });

  return {
    product,
    count: rows.length,
    batches: rows.map(shapeBatch),
  };
};

export default {
  listBatches,
  listExpiring,
  listForProduct,
};