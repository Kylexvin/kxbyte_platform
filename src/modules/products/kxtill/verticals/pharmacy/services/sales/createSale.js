// src/modules/products/kxtill/verticals/pharmacy/services/sales/createSale.js
//
// Pharmacy sale wrapper.
//
// This is the vertical-aware orchestration of a sale:
//   1. Open one transaction
//   2. FEFO allocation — plan which batches supply each sale item
//   3. Delegate to Core createSaleTx — Core creates sale, items, payments
//      and decrements branchProduct.stock (the aggregate)
//   4. Link allocations to the created sale items
//   5. Decrement batchStock.quantityOnHand per allocation
//   6. Write SOLD movements per allocation
//   7. Commit
//
// If any step fails, everything rolls back. No partial sales. No drift.
//
// RESPONSIBILITY SPLIT (locked):
//   Core owns:      branchProduct.stock (the aggregate)
//   Pharmacy owns:  batchStock.quantityOnHand (batch-level)
//   Both stay in sync because they move by the same delta in the same tx.

import prisma from '../../../../../../../database/postgres/prisma.js';
import saleService from '../../../../services/sale.service.js';
import fefoService from '../fefo.service.js';
import pharmacyDb from '../../db/pharmacy.db.js';
import { MOVEMENT_TYPES } from '../../constants/movements.js';

/**
 * Create a pharmacy sale.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.organizationId
 * @param {Object} params.data             - the sale payload (same shape as Core)
 * @returns {Promise<string>}              - the created sale's id
 */
const createSale = async ({ userId, organizationId, data }) => {
  const saleId = await prisma.$transaction(
    async (tx) => {
      // ─────────────────────────────────────────────────────────
      // Step 1 — resolve the branch products and FEFO-allocate each item
      // ─────────────────────────────────────────────────────────
      //
      // We need branchProductId and baseQuantity per item BEFORE calling
      // Core. This mirrors the product/unit resolution Core will do, but
      // we need it earlier so we can call FEFO inside the same tx.
      //
      const allocationPlans = [];

      for (const item of data.items) {
        // Resolve product → find its branch product at this branch
        const product = await tx.kxTillProduct.findFirst({
          where: { id: item.productId, organizationId },
          select: { id: true, trackInventory: true },
        });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Resolve unit → base quantity
        const unit = await tx.kxTillProductUnit.findUnique({
          where: { id: item.unitId },
          select: { id: true, conversionQty: true, productId: true },
        });
        if (!unit || unit.productId !== product.id) {
          throw new Error(`Unit ${item.unitId} not found for product ${item.productId}`);
        }

        const quantity = Number(item.quantity);
        const conversionQty = Number(unit.conversionQty);
        const baseQuantity = quantity * conversionQty;

        // Find the branch product
        const branchProduct = await tx.kxTillBranchProduct.findFirst({
          where: { productId: product.id, branchId: data.branchId },
          select: { id: true },
        });
        if (!branchProduct) {
          throw new Error(`Product ${product.id} is not available at this branch`);
        }

        // Only allocate from batches if the product tracks inventory.
        // Non-tracked pharmacy items (rare) skip FEFO entirely.
        if (product.trackInventory) {
          const { allocations } = await fefoService.allocateFEFO(tx, {
            branchProductId: branchProduct.id,
            baseQuantity,
          });
          allocationPlans.push({
            branchProductId: branchProduct.id,
            baseQuantity,
            allocations,
          });
        } else {
          allocationPlans.push({
            branchProductId: branchProduct.id,
            baseQuantity,
            allocations: [],
          });
        }
      }

      // ─────────────────────────────────────────────────────────
      // Step 2 — Core creates the sale, items, payments, and
      // decrements branchProduct.stock. Returns { saleId, items }.
      // ─────────────────────────────────────────────────────────
      const { saleId: createdSaleId, items: createdItems } = await saleService.createSaleTx(
        tx,
        userId,
        organizationId,
        data
      );

      // Sanity check: same number of items
      if (createdItems.length !== allocationPlans.length) {
        throw new Error(
          `Item count mismatch: Core created ${createdItems.length}, FEFO planned ${allocationPlans.length}`
        );
      }

      // ─────────────────────────────────────────────────────────
      // Step 3 — Link allocations, decrement batch stock, log movements
      // ─────────────────────────────────────────────────────────
      for (let i = 0; i < createdItems.length; i++) {
        const saleItem = createdItems[i];
        const plan = allocationPlans[i];

        for (const alloc of plan.allocations) {
          // 3a. Link the allocation to the sale item
          await pharmacyDb.createSaleBatchAllocationTx(tx, {
            saleItemId: saleItem.id,
            batchStockId: alloc.batchStockId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
            unitCost: alloc.unitCost,
          });

          // 3b. Decrement batch stock atomically
          await pharmacyDb.decrementBatchStockTx(tx, alloc.batchStockId, alloc.quantity);

          // 3c. Log the SOLD movement (signed negative)
          await pharmacyDb.createMovementTx(tx, {
            batchStockId: alloc.batchStockId,
            batchId: alloc.batchId,
            movementType: MOVEMENT_TYPES.SOLD,
            quantity: -alloc.quantity,
            reason: null,
            referenceId: createdSaleId,
            referenceType: 'SALE',
            userId,
          });
        }
      }

      return createdSaleId;
    },
    { maxWait: 5000, timeout: 15000 }
  );

  return saleId;
};

export default {
  createSale,
};