// src/modules/products/kxtill/verticals/pharmacy/services/sales/createOfflineSale.js
//
// Pharmacy offline sale wrapper (Flavor A: server re-runs FEFO).
//
// Flow — same as online pharmacy sale, but uses createOfflineSaleTx:
//   1. FEFO-allocate each item (server-side, fresh)
//   2. Call Core createOfflineSaleTx
//   3. If wasCreated, write batch allocations + decrements + SOLD movements
//
// Idempotency: if clientSaleId already exists, Core returns wasCreated=false.
// We skip all pharmacy writes — no double allocation.
//
// RESPONSIBILITY SPLIT (same as online):
//   Core owns:      branchProduct.stock
//   Pharmacy owns:  batchStock.quantityOnHand

import prisma from '../../../../../../../database/postgres/prisma.js';
import saleService from '../../../../services/sale.service.js';
import fefoService from '../fefo.service.js';
import pharmacyDb from '../../db/pharmacy.db.js';
import { MOVEMENT_TYPES } from '../../constants/movements.js';

const createOfflineSale = async ({ userId, organizationId, data }) => {
  const saleId = await prisma.$transaction(
    async (tx) => {
      // ─────────────────────────────────────────────────
      // Step 1 — FEFO plan for each item
      // ─────────────────────────────────────────────────
      const allocationPlans = [];

      for (const item of data.items) {
        const product = await tx.kxTillProduct.findFirst({
          where: { id: item.productId, organizationId },
          select: { id: true, trackInventory: true },
        });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const unit = await tx.kxTillProductUnit.findUnique({
          where: { id: item.unitId },
          select: { id: true, conversionQty: true, productId: true },
        });
        if (!unit || unit.productId !== product.id) {
          throw new Error(`Unit ${item.unitId} not found for product ${item.productId}`);
        }

        const quantity = Number(item.quantity);
        const baseQuantity = quantity * Number(unit.conversionQty);

        const branchProduct = await tx.kxTillBranchProduct.findFirst({
          where: { productId: product.id, branchId: data.branchId },
          select: { id: true },
        });
        if (!branchProduct) {
          throw new Error(`Product ${product.id} is not available at this branch`);
        }

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

      // ─────────────────────────────────────────────────
      // Step 2 — Core creates the sale (idempotency-aware)
      // ─────────────────────────────────────────────────
      const coreResult = await saleService.createOfflineSaleTx(
        tx,
        userId,
        organizationId,
        data
      );

      const { saleId: createdSaleId, wasCreated, items: createdItems } = coreResult;

      // Idempotent hit — no pharmacy writes
      if (!wasCreated) {
        return createdSaleId;
      }

      // ─────────────────────────────────────────────────
      // Step 3 — Link allocations + batch writes
      // ─────────────────────────────────────────────────
      if (createdItems.length !== allocationPlans.length) {
        throw new Error(
          `Item count mismatch: Core created ${createdItems.length}, FEFO planned ${allocationPlans.length}`
        );
      }

      for (let i = 0; i < createdItems.length; i++) {
        const saleItem = createdItems[i];
        const plan = allocationPlans[i];

        for (const alloc of plan.allocations) {
          await pharmacyDb.createSaleBatchAllocationTx(tx, {
            saleItemId: saleItem.id,
            batchStockId: alloc.batchStockId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
            unitCost: alloc.unitCost,
          });

          await pharmacyDb.decrementBatchStockTx(tx, alloc.batchStockId, alloc.quantity);

          await pharmacyDb.createMovementTx(tx, {
            batchStockId: alloc.batchStockId,
            batchId: alloc.batchId,
            movementType: MOVEMENT_TYPES.SOLD,
            quantity: -alloc.quantity,
            reason: null,
            referenceId: createdSaleId,
            referenceType: 'SALE_OFFLINE',
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
  createOfflineSale,
};