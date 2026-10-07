// src/modules/products/kxtill/verticals/pharmacy/services/receiving.service.js
//
// Receiving stock into a branch.
//
// This is the ONE place where pharmacy stock enters the system. Every batch
// in the database got here through this service.
//
// THE 4-STEP INVARIANT — every pharmacy stock mutation follows this shape,
// all inside one $transaction:
//
//   1. Find or create the batch
//   2. Upsert batch stock (+ quantityOnHand)
//   3. Increment KxTillBranchProduct.stock by the same amount
//   4. Insert a stock movement (audit trail)
//
// If any step fails, the whole thing rolls back. Batch stock and Core
// aggregate stock can never drift.

import prisma from '../../../../../../database/postgres/prisma.js';
import pharmacyDb from '../db/pharmacy.db.js';
import { MOVEMENT_TYPES } from '../constants/movements.js';

/**
 * Receive stock for a pharmacy product at a branch.
 *
 * @param {Object} params
 * @param {string} params.organizationId  - Org that owns this stock
 * @param {string} params.branchId        - Which branch is receiving
 * @param {string} params.productId       - Core product id (KxTillProduct)
 * @param {string} params.batchNumber     - Manufacturer lot / batch number
 * @param {Date}   params.expiryDate      - Batch expiry date
 * @param {number} params.quantityBase    - Quantity in BASE units (tablets, ml, etc.)
 * @param {number} params.unitCost        - Cost per base unit
 * @param {number} [params.sellingPrice]  - Optional selling price per base unit
 * @param {Date}   [params.manufacturedAt]
 * @param {string} [params.manufacturer]
 * @param {string} params.userId          - Who is receiving the stock
 * @param {string} [params.reason]        - Optional note
 * @returns {Promise<{batch, batchStock, branchProduct, movement}>}
 */
const receiveBatch = async (params) => {
  const {
    organizationId,
    branchId,
    productId,
    batchNumber,
    expiryDate,
    quantityBase,
    unitCost,
    sellingPrice,
    manufacturedAt,
    manufacturer,
    userId,
    reason,
  } = params;

  // ─── Validate basics ───
  if (!organizationId) throw new Error('organizationId is required');
  if (!branchId) throw new Error('branchId is required');
  if (!productId) throw new Error('productId is required');
  if (!batchNumber || batchNumber.trim().length === 0) {
    throw new Error('batchNumber is required');
  }
  if (!expiryDate) throw new Error('expiryDate is required');
  if (quantityBase == null || Number(quantityBase) <= 0) {
    throw new Error('quantityBase must be greater than 0');
  }
  if (unitCost == null || Number(unitCost) < 0) {
    throw new Error('unitCost must be zero or greater');
  }
  if (!userId) throw new Error('userId is required');

  // ─── Confirm the branch product exists for this org/branch/product ───
  const branchProduct = await prisma.kxTillBranchProduct.findUnique({
    where: {
      productId_branchId: {
        productId,
        branchId,
      },
    },
  });

  if (!branchProduct) {
    throw new Error(
      'Branch product not found. Create the product at this branch before receiving stock.'
    );
  }

  // ─── The 4-step invariant, all in one transaction ───
  const result = await prisma.$transaction(async (tx) => {
    // Step 1 — find or create the batch
    const batch = await pharmacyDb.upsertBatchTx(tx, {
      productId,
      batchNumber: batchNumber.trim(),
      expiryDate: new Date(expiryDate),
      manufacturedAt: manufacturedAt ? new Date(manufacturedAt) : undefined,
      manufacturer,
    });

    // Step 2 — upsert batch stock (+ quantityOnHand)
    const batchStock = await pharmacyDb.upsertBatchStockTx(tx, {
      batchId: batch.id,
      branchProductId: branchProduct.id,
      quantityDelta: Number(quantityBase),
      unitCost: Number(unitCost),
      sellingPrice: sellingPrice != null ? Number(sellingPrice) : undefined,
    });

    // Step 3 — increment Core branch product stock by the same amount
    const updatedBranchProduct = await pharmacyDb.incrementBranchProductStockTx(
      tx,
      branchProduct.id,
      Number(quantityBase)
    );

    // Step 4 — insert stock movement (audit trail)
    const movement = await pharmacyDb.createMovementTx(tx, {
      batchStockId: batchStock.id,
      batchId: batch.id,
      movementType: MOVEMENT_TYPES.RECEIVED,
      quantity: Number(quantityBase),  // signed convention: positive = inbound
      reason: reason ?? null,
      referenceId: null,
      referenceType: 'MANUAL_RECEIVE',
      userId,
    });

    return { batch, batchStock, branchProduct: updatedBranchProduct, movement };
  });

  return result;
};

export default {
  receiveBatch,
};