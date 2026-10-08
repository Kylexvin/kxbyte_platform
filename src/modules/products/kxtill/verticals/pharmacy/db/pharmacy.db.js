// src/modules/products/kxtill/verticals/pharmacy/db/pharmacy.db.js
//
// Prisma query layer for the pharmacy vertical.
// Mirrors the style of Core's db files (thin functions, no business logic).
//
// Business rules live in services. This file only talks to the database.

import prisma from '../../../../../../database/postgres/prisma.js';

// ============================================================
// BATCHES
// ============================================================

const findBatch = async (productId, batchNumber, expiryDate) => {
  return prisma.kxTillPharmacyBatch.findUnique({
    where: {
      productId_batchNumber_expiryDate: {
        productId,
        batchNumber,
        expiryDate,
      },
    },
  });
};

const createBatch = async (data) => {
  return prisma.kxTillPharmacyBatch.create({ data });
};

const findBatchById = async (id) => {
  return prisma.kxTillPharmacyBatch.findUnique({
    where: { id },
  });
};

// ============================================================
// BATCH STOCK
// ============================================================

const findBatchStock = async (batchId, branchProductId) => {
  return prisma.kxTillPharmacyBatchStock.findUnique({
    where: {
      batchId_branchProductId: {
        batchId,
        branchProductId,
      },
    },
  });
};

const findBatchStockById = async (id) => {
  return prisma.kxTillPharmacyBatchStock.findUnique({
    where: { id },
  });
};

// ============================================================
// STOCK MOVEMENTS
// ============================================================

const createMovement = async (data) => {
  return prisma.kxTillPharmacyStockMovement.create({ data });
};

// ============================================================
// TRANSACTION HELPERS (take tx as first arg — used inside $transaction)
// ============================================================

// Upsert a batch and return it (idempotent — safe to call repeatedly).
const upsertBatchTx = async (tx, { productId, batchNumber, expiryDate, manufacturedAt, manufacturer }) => {
  return tx.kxTillPharmacyBatch.upsert({
    where: {
      productId_batchNumber_expiryDate: {
        productId,
        batchNumber,
        expiryDate,
      },
    },
    update: {
      // Non-key fields can be updated if provided
      ...(manufacturedAt !== undefined && { manufacturedAt }),
      ...(manufacturer !== undefined && { manufacturer }),
    },
    create: {
      productId,
      batchNumber,
      expiryDate,
      manufacturedAt: manufacturedAt ?? null,
      manufacturer: manufacturer ?? null,
    },
  });
};

// Upsert batch stock — creates row if missing, increments quantity if exists.
// Accepts a Prisma.TransactionClient (tx), not the top-level prisma client.
const upsertBatchStockTx = async (tx, { batchId, branchProductId, quantityDelta, unitCost, sellingPrice }) => {
  return tx.kxTillPharmacyBatchStock.upsert({
    where: {
      batchId_branchProductId: {
        batchId,
        branchProductId,
      },
    },
    update: {
      quantityOnHand: { increment: quantityDelta },
      ...(unitCost !== undefined && { unitCost }),
      ...(sellingPrice !== undefined && { sellingPrice }),
    },
    create: {
      batchId,
      branchProductId,
      quantityOnHand: quantityDelta,
      unitCost: unitCost ?? 0,
      sellingPrice: sellingPrice ?? null,
      status: 'AVAILABLE',
    },
  });
};

// Increment KxTillBranchProduct.stock (the Core aggregate). Same delta as batch stock.
const incrementBranchProductStockTx = async (tx, branchProductId, quantityDelta) => {
  return tx.kxTillBranchProduct.update({
    where: { id: branchProductId },
    data: { stock: { increment: quantityDelta } },
  });
};

// Create a stock movement row inside a transaction.
const createMovementTx = async (tx, data) => {
  return tx.kxTillPharmacyStockMovement.create({ data });
};

// ============================================================
// BATCH READS (list, expiring, per-product with FEFO sort)
// ============================================================

// List batches for an organization, optionally filtered by branch.
// Returns each batch with its per-branch stock (which may be empty if
// the batch has no stock at the requested branch).
const listBatches = async ({ organizationId, branchId, take = 100, skip = 0 }) => {
  const where = {
    product: { organizationId },
    ...(branchId && {
      stocks: { some: { branchProduct: { branchId } } },
    }),
  };

  return prisma.kxTillPharmacyBatch.findMany({
    where,
    orderBy: { expiryDate: 'asc' },
    take,
    skip,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      stocks: branchId
        ? {
            where: { branchProduct: { branchId } },
            include: {
              branchProduct: {
                select: { id: true, branchId: true, stock: true },
              },
            },
          }
        : {
            include: {
              branchProduct: {
                select: { id: true, branchId: true, stock: true },
              },
            },
          },
    },
  });
};

// Batches expiring within `days` from now, for an organization.
// Optionally filter by branch. Only includes batches with stock.
const listExpiringBatches = async ({ organizationId, branchId, days = 90 }) => {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  return prisma.kxTillPharmacyBatch.findMany({
    where: {
      product: { organizationId },
      expiryDate: { gte: now, lte: cutoff },
      stocks: {
        some: {
          quantityOnHand: { gt: 0 },
          status: 'AVAILABLE',
          ...(branchId && { branchProduct: { branchId } }),
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      stocks: {
        where: {
          quantityOnHand: { gt: 0 },
          status: 'AVAILABLE',
          ...(branchId && { branchProduct: { branchId } }),
        },
        include: {
          branchProduct: {
            select: { id: true, branchId: true, stock: true },
          },
        },
      },
    },
  });
};

// Batches for a single product, FEFO-ordered (earliest expiry first).
// Optionally filtered by branch. Only includes batches with stock > 0.
const listBatchesForProduct = async ({ productId, branchId }) => {
  return prisma.kxTillPharmacyBatch.findMany({
    where: {
      productId,
      ...(branchId && {
        stocks: {
          some: {
            quantityOnHand: { gt: 0 },
            status: 'AVAILABLE',
            branchProduct: { branchId },
          },
        },
      }),
    },
    orderBy: { expiryDate: 'asc' },     // ← FEFO order
    include: {
      stocks: {
        where: {
          ...(branchId && { branchProduct: { branchId } }),
          quantityOnHand: { gt: 0 },
        },
        include: {
          branchProduct: {
            select: { id: true, branchId: true, stock: true },
          },
        },
      },
    },
  });
};

// ============================================================
// SALE BATCH ALLOCATIONS
// ============================================================

// Link a sale item to a batch that supplied it.
// Idempotent-safe: caller is inside the sale transaction, so a duplicate
// would violate the schema (no unique constraint today — but this should
// never be called twice for the same (saleItemId, batchId) pair in practice).
const createSaleBatchAllocationTx = async (tx, data) => {
  return tx.kxTillPharmacySaleBatchAllocation.create({ data });
};

// ============================================================
// BATCH STOCK — ATOMIC DECREMENT
// ============================================================

// Decrement batch stock atomically. Uses `decrement` to avoid read-modify-write
// races. Caller must have already locked the row via FEFO's FOR UPDATE.
const decrementBatchStockTx = async (tx, batchStockId, quantity) => {
  return tx.kxTillPharmacyBatchStock.update({
    where: { id: batchStockId },
    data: { quantityOnHand: { decrement: quantity } },
  });
};

export default {
  // Batches
  findBatch,
  createBatch,
  listBatches,
  listExpiringBatches,
  listBatchesForProduct,

  findBatchById,

  // Batch stock
  findBatchStock,
  findBatchStockById,

  // Movements
  createMovement,

  // Transaction helpers (used inside $transaction)
  upsertBatchTx,
  upsertBatchStockTx,
  incrementBranchProductStockTx,
  createMovementTx,

  //sale operations
  createSaleBatchAllocationTx,
  decrementBatchStockTx,
};