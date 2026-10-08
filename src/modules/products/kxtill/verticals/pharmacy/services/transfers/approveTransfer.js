// src/modules/products/kxtill/verticals/pharmacy/services/transfers/approveTransfer.js
//
// Pharmacy transfer-approval wrapper.
//
// Core moves abstract stock (branchProduct.stock). Pharmacy moves the
// physical batch behind that stock, atomically, in the same transaction.
//
// Flow:
//   1. Call Core approveTransferTx — moves aggregate stock, updates status.
//   2. FEFO-select which batches at source supply the transfer quantity.
//   3. For each allocated batch:
//        - decrement source batch stock
//        - increment (or create) destination batch stock — SAME batch
//        - write TRANSFERRED_OUT movement at source
//        - write TRANSFERRED_IN  movement at destination
//
// RESPONSIBILITY SPLIT (same as sale/refund):
//   Core owns:      branchProduct.stock (the aggregate)
//   Pharmacy owns:  batchStock.quantityOnHand (batch-level)

import prisma from '../../../../../../../database/postgres/prisma.js';
import transferService from '../../../../transfer/services/transfer.service.js';
import fefoService from '../fefo.service.js';
import pharmacyDb from '../../db/pharmacy.db.js';
import { MOVEMENT_TYPES } from '../../constants/movements.js';

/**
 * Approve a pharmacy transfer with FEFO batch selection.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.organizationId
 * @param {string} params.transferId
 * @returns {Promise<Object>} — the updated transfer
 */
const approveTransfer = async ({ userId, organizationId, transferId }) => {
  const result = await prisma.$transaction(
    async (tx) => {
      // ─────────────────────────────────────────────────────
      // Step 1 — Core: move aggregate, update status.
      // ─────────────────────────────────────────────────────
      const core = await transferService.approveTransferTx(
        tx,
        userId,
        organizationId,
        transferId
      );

      const {
        sourceBranchProductId,
        destBranchProductId,
        quantity,
      } = core;

      // ─────────────────────────────────────────────────────
      // Step 2 — FEFO-select source batches
      // ─────────────────────────────────────────────────────
      const { allocations } = await fefoService.allocateFEFO(tx, {
        branchProductId: sourceBranchProductId,
        baseQuantity: quantity,
      });

      // ─────────────────────────────────────────────────────
      // Step 3 — Apply batch movements at both branches
      // ─────────────────────────────────────────────────────
      for (const alloc of allocations) {
        // 3a. Decrement source batch stock
        await pharmacyDb.decrementBatchStockTx(tx, alloc.batchStockId, alloc.quantity);

        // 3b. Upsert destination batch stock — SAME batch, new branch
        const destBatchStock = await tx.kxTillPharmacyBatchStock.upsert({
          where: {
            batchId_branchProductId: {
              batchId: alloc.batchId,
              branchProductId: destBranchProductId,
            },
          },
          update: { quantityOnHand: { increment: alloc.quantity } },
          create: {
            batchId: alloc.batchId,
            branchProductId: destBranchProductId,
            quantityOnHand: alloc.quantity,
            unitCost: alloc.unitCost,
            status: 'AVAILABLE',
          },
        });

        // 3c. TRANSFERRED_OUT movement at source
        await pharmacyDb.createMovementTx(tx, {
          batchStockId: alloc.batchStockId,
          batchId: alloc.batchId,
          movementType: MOVEMENT_TYPES.TRANSFERRED_OUT,
          quantity: -alloc.quantity,
          reason: null,
          referenceId: core.transferId,
          referenceType: 'TRANSFER',
          userId,
        });

        // 3d. TRANSFERRED_IN movement at destination
        await pharmacyDb.createMovementTx(tx, {
          batchStockId: destBatchStock.id,
          batchId: alloc.batchId,
          movementType: MOVEMENT_TYPES.TRANSFERRED_IN,
          quantity: alloc.quantity,
          reason: null,
          referenceId: core.transferId,
          referenceType: 'TRANSFER',
          userId,
        });
      }

      return core.transfer;
    },
    { maxWait: 5000, timeout: 15000 }
  );

  return result;
};

export default {
  approveTransfer,
};