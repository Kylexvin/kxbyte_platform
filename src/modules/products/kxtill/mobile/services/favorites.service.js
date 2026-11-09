// src/modules/products/kxtill/mobile/services/favorites.service.js
//
// Mobile-scoped product favorites. Per user + branch. Backed by
// kxtill_favorite_products (model KxTillFavoriteProduct).
//
// Favorites are what a cashier taps most often — one tap adds to cart.
// They're per-user (not per-branch-wide) so each cashier curates their own
// quick-picks, but they're scoped to the branch so favorites don't leak
// across branches.

import prisma from '../../../../../database/postgres/prisma.js';

export async function listFavorites(ctx, branchId) {
  const { organizationId, user } = ctx;

  const rows = await prisma.kxTillFavoriteProduct.findMany({
    where: { organizationId, userId: user.id, branchId },
    orderBy: { createdAt: 'desc' },
    select: { productId: true },
  });
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.productId);

  // Hydrate with branch-stock + units so the client can addToCart directly
  // without a second fetch per chip.
  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: { branchId, productId: { in: productIds } },
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
          baseUnitId: true,
          baseUnit: true,
          units: true,
        },
      },
    },
  });

  const bpByProduct = new Map(branchProducts.map((bp) => [bp.productId, bp]));
  const order = new Map(productIds.map((id, i) => [id, i]));
  const items = [];

  for (const id of productIds) {
    const bp = bpByProduct.get(id);
    if (!bp || !bp.product) continue;
    items.push(shapeFavoriteProduct(bp));
  }

  // Re-sort in the order the favorites were created (desc).
  items.sort((a, b) => order.get(a.productId) - order.get(b.productId));
  return items;
}

export async function toggleFavorite(ctx, branchId, productId) {
  const { organizationId, user } = ctx;

  // Guard: the product must belong to this organization.
  const product = await prisma.kxTillProduct.findFirst({
    where: { id: productId, organizationId },
    select: { id: true },
  });
  if (!product) {
    throw Object.assign(new Error('Product not found'), {
      status: 404,
      code: 'PRODUCT_NOT_FOUND',
    });
  }

  const existing = await prisma.kxTillFavoriteProduct.findUnique({
    where: {
      userId_branchId_productId: {
        userId: user.id,
        branchId,
        productId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.kxTillFavoriteProduct.delete({ where: { id: existing.id } });
    return { productId, favorited: false };
  }

  await prisma.kxTillFavoriteProduct.create({
    data: {
      organizationId,
      userId: user.id,
      branchId,
      productId,
    },
  });
  return { productId, favorited: true };
}

function shapeFavoriteProduct(bp) {
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
  listFavorites,
  toggleFavorite,
};