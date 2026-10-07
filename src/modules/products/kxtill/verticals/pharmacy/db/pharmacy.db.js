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

export default {
  // Batches
  findBatch,
  createBatch,
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
};