// src/modules/products/kxtill/verticals/pharmacy/services/fefo.service.js
//
// FEFO (First-Expiry-First-Out) batch allocator.
//
// Given a branchProduct and a quantity, this service decides WHICH batches
// supply the sale, in what quantity. It does NOT write anything — it only
// plans the allocation.
//
// The caller (the pharmacy sale service) is responsible for:
//   - decrementing each batchStock.quantityOnHand
//   - decrementing branchProduct.stock
//   - writing KxTillPharmacySaleBatchAllocation rows
//   - writing SOLD movements
//
// MUST run inside a Prisma $transaction.
//
// CONCURRENCY: this service uses SELECT ... FOR UPDATE on eligible batch
// stock rows. Two concurrent sales at different counters will serialize on
// the same batch rows, so they can never oversell. Counter B waits for
// Counter A's transaction to commit, then sees the updated quantity.

/**
 * Allocate stock from batches for one sale item.
 *
 * @param {Prisma.TransactionClient} tx
 * @param {Object} params
 * @param {string} params.branchProductId  - KxTillBranchProduct.id
 * @param {number} params.baseQuantity     - Units to consume (in base units)
 * @returns {Promise<{ allocations: Array<{batchId, batchStockId, quantity, unitCost}>, totalAllocated: number }>}
 * @throws if insufficient stock
 */
const allocateFEFO = async (tx, { branchProductId, baseQuantity }) => {
  if (!branchProductId) throw new Error('branchProductId is required');
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) {
    throw new Error('baseQuantity must be a positive number');
  }

  // ─── Lock eligible batch stock rows, ordered by expiry (FEFO) ───
  //
  // FOR UPDATE OF bs — locks only the batch stock rows, not the joined batch.
  // Expiry filter: only future-dated batches, never expired.
  // Status filter: only AVAILABLE (no quarantined, recalled, expired).
  //
  const rows = await tx.$queryRaw`
    SELECT
      bs.id                AS "batchStockId",
      bs."batchId"         AS "batchId",
      bs."quantityOnHand"  AS "quantityOnHand",
      bs."unitCost"        AS "unitCost",
      b."expiryDate"       AS "expiryDate"
    FROM "kxtill_pharmacy_batch_stock" bs
    JOIN "kxtill_pharmacy_batches" b ON b.id = bs."batchId"
    WHERE
      bs."branchProductId" = ${branchProductId}
      AND bs."quantityOnHand" > 0
      AND bs.status = 'AVAILABLE'
      AND b."expiryDate" > NOW()
    ORDER BY b."expiryDate" ASC
    FOR UPDATE OF bs
  `;

  // ─── Compute total available ───
  const totalAvailable = rows.reduce(
    (sum, r) => sum + Number(r.quantityOnHand),
    0
  );

  if (totalAvailable < baseQuantity) {
    const err = new Error(
      `Insufficient stock: requested ${baseQuantity}, available ${totalAvailable}`
    );
    err.code = 'INSUFFICIENT_STOCK';
    err.requested = baseQuantity;
    err.available = totalAvailable;
    throw err;
  }

  // ─── Greedy FEFO walk ───
  const allocations = [];
  let remaining = baseQuantity;

  for (const row of rows) {
    if (remaining <= 0) break;

    const available = Number(row.quantityOnHand);
    const take = Math.min(available, remaining);

    allocations.push({
      batchId: row.batchId,
      batchStockId: row.batchStockId,
      quantity: take,
      unitCost: Number(row.unitCost),
    });

    remaining -= take;
  }

  // Safety: this should never happen if totalAvailable check passed
  if (remaining > 0) {
    const err = new Error(
      `FEFO allocation incomplete: ${remaining} units unallocated`
    );
    err.code = 'FEFO_INCOMPLETE';
    throw err;
  }

  return {
    allocations,
    totalAllocated: baseQuantity,
  };
};

export default {
  allocateFEFO,
};