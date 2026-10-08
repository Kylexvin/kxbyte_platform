// src/modules/products/kxtill/verticals/pharmacy/services/sales/refundSale.js
//
// Pharmacy refund wrapper.
//
// Flow (all in one transaction):
//   1. Delegate to Core refundSaleTx — it validates, creates the refund,
//      creates refund items, restores branchProduct.stock, updates sale
//      status, and handles credit reversal.
//   2. For each refunded item, reverse its outbound sale batch allocations:
//        - increment batchStock.quantityOnHand
//        - increment KxTillPharmacySaleBatchAllocation.refundedQuantity
//        - write KxTillPharmacyRefundAllocation row
//        - write REFUNDED movement
//
// RESPONSIBILITY SPLIT (same as sale):
//   Core owns:      branchProduct.stock (the aggregate)
//   Pharmacy owns:  batchStock.quantityOnHand (batch-level)
//
// VALIDATION:
//   Refund allocations MUST be explicitly provided by the caller.
//   The refund says WHICH batch the physical units came from.
//
//   For each requested (batchId, quantity):
//     requested quantity
//       ≤ allocation.quantity - allocation.refundedQuantity
//
// FEFO is outbound only. Refund uses original allocation.

import prisma from '../../../../../../../database/postgres/prisma.js';
import saleService from '../../../../services/sale.service.js';
import pharmacyDb from '../../db/pharmacy.db.js';
import { MOVEMENT_TYPES } from '../../constants/movements.js';

/**
 * Refund a pharmacy sale with explicit batch allocations.
 *
 * Payload must include `items` in Core's shape PLUS an `allocations` array
 * per item, indicating which batches the returned units came from:
 *
 *   items: [
 *     {
 *       saleItemId,
 *       quantity,
 *       allocations: [ { batchId, quantity }, ... ]
 *     }
 *   ]
 *
 * @returns {Promise<Object>} same shape as Core refundSale
 */
const refundSale = async ({ organizationId, userId, saleId, payload = {} }) => {
  const { items: requestedItems } = payload;

  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new Error('At least one item is required for refund');
  }

  // Validate that every refunded item has allocations
  for (const item of requestedItems) {
    if (!Array.isArray(item.allocations) || item.allocations.length === 0) {
      throw new Error(
        `Pharmacy refunds require explicit batch allocations for saleItem ${item.saleItemId}`
      );
    }
    const allocSum = item.allocations.reduce(
      (s, a) => s + Number(a.quantity || 0),
      0
    );
    if (Math.abs(allocSum - Number(item.quantity)) > 1e-6) {
      throw new Error(
        `Allocation quantities (${allocSum}) must sum to refund quantity (${item.quantity}) for saleItem ${item.saleItemId}`
      );
    }
  }

  // Strip allocations from the payload before passing to Core
  const corePayload = {
    ...payload,
    items: requestedItems.map((i) => ({
      saleItemId: i.saleItemId,
      quantity: i.quantity,
    })),
  };

  // ─── One transaction: Core + pharmacy writes ───
  const coreResult = await prisma.$transaction(
    async (tx) => {
      // 1. Core does its job — creates refund, restores aggregate, etc.
      const result = await saleService.refundSaleTx(
        tx,
        organizationId,
        userId,
        saleId,
        corePayload
      );

      // 2. Pharmacy reverses batch allocations for each refunded item
      for (const refundedItem of result.refundedItems) {
        const requestItem = requestedItems.find(
          (i) => i.saleItemId === refundedItem.saleItemId
        );
        if (!requestItem) continue;

        for (const alloc of requestItem.allocations) {
          const requestedQty = Number(alloc.quantity);
          if (requestedQty <= 0) continue;

          // Find the original outbound allocation for this (saleItem, batch)
          const saleAlloc = await pharmacyDb.findSaleAllocationByBatchTx(
            tx,
            refundedItem.saleItemId,
            alloc.batchId
          );

          if (!saleAlloc) {
            throw new Error(
              `No original sale allocation found for batch ${alloc.batchId} on sale item ${refundedItem.saleItemId}`
            );
          }

          // Validate remaining refundable quantity
          const allocQty = Number(saleAlloc.quantity);
          const alreadyReversed = Number(saleAlloc.refundedQuantity || 0);
          const available = allocQty - alreadyReversed;

          if (requestedQty > available + 1e-6) {
            throw new Error(
              `Refund quantity ${requestedQty} exceeds remaining allocation for batch ${alloc.batchId} (available: ${available})`
            );
          }

          // 3a. Increment batch stock
          await pharmacyDb.incrementBatchStockTx(
            tx,
            saleAlloc.batchStockId,
            requestedQty
          );

          // 3b. Increment allocation refunded counter
          await pharmacyDb.incrementAllocationRefundedTx(
            tx,
            saleAlloc.id,
            requestedQty
          );

          // 3c. Write refund → batch allocation row
          await pharmacyDb.createRefundAllocationTx(tx, {
            refundItemId: refundedItem.refundItemId,
            saleAllocationId: saleAlloc.id,
            batchId: saleAlloc.batchId,
            batchStockId: saleAlloc.batchStockId,
            quantity: requestedQty,
          });

          // 3d. Write REFUNDED movement
          await pharmacyDb.createMovementTx(tx, {
            batchStockId: saleAlloc.batchStockId,
            batchId: saleAlloc.batchId,
            movementType: MOVEMENT_TYPES.REFUNDED,
            quantity: requestedQty,   // positive — inbound
            reason: null,
            referenceId: result.refundId,
            referenceType: 'REFUND',
            userId,
          });
        }
      }

      return result;
    },
    { maxWait: 5000, timeout: 15000 }
  );

  return coreResult;
};

export default {
  refundSale,
};