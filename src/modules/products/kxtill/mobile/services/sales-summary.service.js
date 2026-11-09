// src/modules/products/kxtill/mobile/services/sales-summary.service.js
//
// Aggregates sold products for the POS quick-picks strip.
// Two flavors:
//   - recent: last N distinct products sold at this branch
//   - top:    top N products by quantity sold over the last `days` days
//
// Both return the same shape so the client uses one renderer:
//   { productId, branchProductId, name, sku, taxRate, stock,
//     isAvailable, baseUnit, units }

import prisma from '../../../../../database/postgres/prisma.js';

/* ── recent ─────────────────────────────────────────────────── */

export async function getRecentProducts(organizationId, branchId, limit = 10) {
  // Pull the most recent sale items at this branch, then dedupe by product
  // keeping the first occurrence (i.e. most-recent).
  const rows = await prisma.kxTillSaleItem.findMany({
    where: {
      sale: {
        organizationId,
        branchId,
        status: { in: ['COMPLETED', 'REFUNDED_PARTIAL', 'REFUNDED'] },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit * 5, 100),
    select: { productId: true },
  });

  const seen = new Set();
  const productIds = [];
  for (const r of rows) {
    if (seen.has(r.productId)) continue;
    seen.add(r.productId);
    productIds.push(r.productId);
    if (productIds.length >= limit) break;
  }

  if (productIds.length === 0) return [];
  return hydrate(productIds, organizationId, branchId);
}

/* ── top ────────────────────────────────────────────────────── */

export async function getTopProducts(
  organizationId,
  branchId,
  limit = 10,
  days = 30
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.kxTillSaleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        organizationId,
        branchId,
        status: { in: ['COMPLETED', 'REFUNDED_PARTIAL', 'REFUNDED'] },
        createdAt: { gte: since },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  const productIds = grouped.map((g) => g.productId);
  if (productIds.length === 0) return [];
  return hydrate(productIds, organizationId, branchId);
}

/* ── hydration ──────────────────────────────────────────────── */
//
// Both recent and top need the same product shape the client's
// handleAdd expects. This reuses the favorites shape exactly.

async function hydrate(productIds, organizationId, branchId) {
  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: {
      branchId,
      productId: { in: productIds },
      product: { organizationId },
    },
    select: {
      id: true,
      productId: true,
      stock: true,
      isAvailable: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          taxRate: true,
          baseUnit: true,
          units: true,
        },
      },
    },
  });

  const byProductId = new Map(branchProducts.map((bp) => [bp.productId, bp]));
  const items = [];
  for (const id of productIds) {
    const bp = byProductId.get(id);
    if (!bp || !bp.product) continue;
    items.push(shape(bp));
  }
  return items;
}

function shape(bp) {
  const p = bp.product;
  return {
    productId: p.id,
    branchProductId: bp.id,
    name: p.name,
    sku: p.sku || null,
    taxRate: Number(p.taxRate) || 0,
    stock: Number(bp.stock) || 0,
    isAvailable: bp.isAvailable !== false,
    baseUnit: p.baseUnit || null,
    units: p.units || [],
  };
}

export default {
  getRecentProducts,
  getTopProducts,
};