// src/modules/products/kxtill/verticals/pharmacy/services/sales/createSale.js
//
// Pharmacy sale wrapper.
//
// This is the vertical-aware orchestration of a sale:
//
//   PHASE 1 — reads, NO transaction (no pooled connection held)
//     a. Core prepareSale: access checks, shift, customer, products, units,
//        branch products, credit validation, totals, payments
//     b. Which products are batch-tracked (pharmacyProduct present)
//
//   PHASE 2 — one short transaction, writes + row locks only
//     1. FEFO allocation — ONE call per distinct branch product (quantities
//        for repeated lines are summed), in sorted branchProductId order
//     2. Delegate to Core createSaleTx — Core creates sale, items, payments
//        and decrements branchProduct.stock (the aggregate)
//     3. Split each product's allocations back across its sale lines
//     4. Bulk-insert allocation rows (1 query)
//     5. Guarded batchStock decrement, one per distinct batch row
//     6. Bulk-insert SOLD movements (1 query)
//     7. Commit
//
// If any step in phase 2 fails, everything rolls back. No partial sales.
// Phase 1 writes nothing, so there is nothing to undo if it fails.
//
// WHY THE SPLIT: prisma.$transaction(async tx => ...) holds one pooled
// connection for the whole callback. Reads that use the global client inside
// it need a SECOND connection, so concurrent sales each hold one connection
// while queueing for another and burn the transaction timeout (P2028).
//
// RESPONSIBILITY SPLIT (locked):
//   Core owns:      branchProduct.stock (the aggregate)
//   Pharmacy owns:  batchStock.quantityOnHand (batch-level)
//   Both stay in sync because they move by the same delta in the same tx.

import prisma from '../../../../../../../database/postgres/prisma.js';
import saleService from '../../../../services/sale.service.js';
import fefoService from '../fefo.service.js';
import pharmacyDb from '../../db/pharmacy.db.js';
import saleDb from '../../../../db/sale.db.js';
import { MOVEMENT_TYPES } from '../../constants/movements.js';

const EPS = 1e-9;
const LEFTOVER_TOLERANCE = 1e-6;
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const ms = (from) => Math.round(performance.now() - from);

// Round-trip probe: N sequential `SELECT 1`. Enable with SALE_TIMING_PROBE=1.
// Shows the raw per-statement latency between this server and the database.
const probeRtt = async (n = 5) => {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    samples.push(ms(t));
  }
  return samples;
};

// Splits one product's FEFO allocations across the sale lines that share it.
// `lineQuantities` are the base quantities of those lines, in line order.
// Returns one allocation array per line; each sums to that line's quantity.
// A batch row that straddles two lines is split between them.
const splitAllocations = (allocations, lineQuantities) => {
  const queue = allocations.map((a) => ({ ...a, left: a.quantity }));
  let q = 0;

  return lineQuantities.map((need) => {
    const out = [];
    let remaining = need;

    while (remaining > EPS && q < queue.length) {
      const seg = queue[q];
      const take = Math.min(seg.left, remaining);

      if (take > EPS) {
        out.push({
          batchId: seg.batchId,
          batchStockId: seg.batchStockId,
          quantity: round6(take),
          unitCost: seg.unitCost,
        });
      }

      seg.left = round6(seg.left - take);
      remaining = round6(remaining - take);
      if (seg.left <= EPS) q++;
    }

    if (remaining > LEFTOVER_TOLERANCE) {
      throw new Error(
        `FEFO split incomplete: ${remaining} units could not be assigned to a sale line`
      );
    }

    return out;
  });
};

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
  // Idempotency pre-flight — mirrors Core createSale.
  // A repeated clientSaleId must return the existing sale, not throw P2002.
  if (data.clientSaleId) {
    const existing = await saleDb.findSaleByClientId(data.clientSaleId);
    if (existing) {
      const found = await saleDb.findSaleById(existing.id, organizationId);
      if (found) return found.id;
    }
  }

  if (process.env.SALE_TIMING_PROBE === '1') {
    console.log(
      `[pharmacy/sale] rtt probe (SELECT 1 x5): ${(await probeRtt()).join(', ')} ms`
    );
  }

  const t0 = performance.now();
  const timings = { prepare: 0, pharmacyFlags: 0, fefo: 0, core: 0, alloc: 0 };

  // ---------------- PHASE 1: reads, outside the transaction ----------------
  const productIds = [...new Set(data.items.map((i) => i.productId))];

  const tFlags = performance.now();
  const [prepared, pharmacyRows] = await Promise.all([
    saleService.prepareSale(userId, organizationId, data),
    prisma.kxTillProduct
      .findMany({
        where: { id: { in: productIds }, organizationId },
        select: { id: true, pharmacyProduct: true },
      })
      .then((rows) => {
        timings.pharmacyFlags = ms(tFlags);
        return rows;
      }),
  ]);

  const batchTracked = new Set(
    pharmacyRows.filter((r) => r.pharmacyProduct).map((r) => r.id)
  );

  // prepared.preparedItems is in the same order as data.items, and Core's
  // createSaleTx returns created items in that same order.
  const lines = prepared.preparedItems.map((it, index) => ({
    index,
    branchProductId: it.branchProduct.id,
    baseQuantity: it.baseQuantity,
    useFefo: it.trackInventory && batchTracked.has(it.product.id),
  }));

  // Group FEFO lines by branch product. Same product on several lines is
  // allocated ONCE for the summed quantity, then split back across the lines.
  const fefoGroups = new Map(); // branchProductId -> { total, lines: [] }
  for (const line of lines) {
    if (!line.useFefo) continue;
    const group = fefoGroups.get(line.branchProductId) ?? { total: 0, lines: [] };
    group.total = round6(group.total + line.baseQuantity);
    group.lines.push(line);
    fefoGroups.set(line.branchProductId, group);
  }

  // Stable lock order across concurrent sales (prevents A,B vs B,A deadlocks).
  const fefoOrder = [...fefoGroups.keys()].sort();

  const tPrepared = performance.now();
  timings.prepare = ms(t0);

  // ---------------- PHASE 2: short transaction, writes only ----------------
  let saleId;
  try {
    saleId = await prisma.$transaction(
      async (tx) => {
        // 1. FEFO allocation (locks batch rows; must be inside the tx)
        let t = performance.now();
        const allocationsByProduct = new Map();
        for (const branchProductId of fefoOrder) {
          const { allocations } = await fefoService.allocateFEFO(tx, {
            branchProductId,
            baseQuantity: fefoGroups.get(branchProductId).total,
          });
          allocationsByProduct.set(branchProductId, allocations);
        }
        timings.fefo = ms(t);

        // 2. Core sale (sale, items, payments, aggregate stock decrement)
        t = performance.now();
        const { saleId: createdSaleId, items: createdItems } =
          await saleService.createSaleTx(tx, userId, organizationId, data, prepared);
        timings.core = ms(t);

        if (createdItems.length !== lines.length) {
          throw new Error(
            `Item count mismatch: Core created ${createdItems.length}, FEFO planned ${lines.length}`
          );
        }

        // 3. Split each product's allocations back across its sale lines
        t = performance.now();
        const allocationsByLine = new Array(lines.length).fill(null).map(() => []);
        for (const [branchProductId, group] of fefoGroups) {
          const perLine = splitAllocations(
            allocationsByProduct.get(branchProductId),
            group.lines.map((l) => l.baseQuantity)
          );
          group.lines.forEach((line, i) => {
            allocationsByLine[line.index] = perLine[i];
          });
        }

        // 4-6. Build rows, then write in bulk
        const allocationRows = [];
        const movementRows = [];
        const decrements = new Map(); // batchStockId -> total quantity

        for (let i = 0; i < createdItems.length; i++) {
          const saleItem = createdItems[i];

          for (const alloc of allocationsByLine[i]) {
            allocationRows.push({
              saleItemId: saleItem.id,
              batchStockId: alloc.batchStockId,
              batchId: alloc.batchId,
              quantity: alloc.quantity,
              unitCost: alloc.unitCost,
            });

            movementRows.push({
              batchStockId: alloc.batchStockId,
              batchId: alloc.batchId,
              movementType: MOVEMENT_TYPES.SOLD,
              quantity: -alloc.quantity,
              reason: null,
              referenceId: createdSaleId,
              referenceType: 'SALE',
              userId,
            });

            decrements.set(
              alloc.batchStockId,
              round6((decrements.get(alloc.batchStockId) ?? 0) + alloc.quantity)
            );
          }
        }

        if (allocationRows.length > 0) {
          await pharmacyDb.createSaleBatchAllocationsTx(tx, allocationRows);

          // Rows are already locked by FEFO's FOR UPDATE. The guard makes
          // negative batch stock impossible even if a plan were wrong.
          for (const [batchStockId, quantity] of decrements) {
            await pharmacyDb.decrementBatchStockGuardedTx(tx, batchStockId, quantity);
          }

          await pharmacyDb.createMovementsTx(tx, movementRows);
        }
        timings.alloc = ms(t);

        return createdSaleId;
      },
      { maxWait: 5000, timeout: 15000 }
    );
  } catch (e) {
    // P2002 = unique constraint on clientSaleId. Another concurrent
    // request won the race; return the winner's sale.
    if (e?.code === 'P2002' && data.clientSaleId) {
      const dup = await saleDb.findSaleByClientId(data.clientSaleId);
      if (dup) {
        const found = await saleDb.findSaleById(dup.id, organizationId);
        if (found) return found.id;
      }
    }
    throw e;
  }

  console.log(
    `[pharmacy/sale] org=${organizationId} items=${data.items.length} ` +
      `prepare=${timings.prepare}ms tx=${ms(tPrepared)}ms ` +
      `(fefo=${timings.fefo} core=${timings.core} alloc=${timings.alloc}) ` +
      `total=${ms(t0)}ms`
  );
  console.log(
    `[pharmacy/sale] prepare detail ${JSON.stringify(prepared.timings)} ` +
      `pharmacyFlags=${timings.pharmacyFlags}ms`
  );

  return saleId;
};

export default {
  createSale,
};