-- ============================================================
-- Pharmacy refund batch allocation
--   - KxTillPharmacySaleBatchAllocation: add refundedQuantity counter
--   - NEW table: kxtill_pharmacy_refund_allocations
-- ============================================================

-- 1. Add refundedQuantity to sale batch allocations
ALTER TABLE "kxtill_pharmacy_sale_batch_allocations"
  ADD COLUMN IF NOT EXISTS "refundedQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- 2. New table: refund → batch allocation
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_refund_allocations" (
  "id"               TEXT NOT NULL,
  "refundItemId"     TEXT NOT NULL,
  "saleAllocationId" TEXT NOT NULL,
  "batchId"          TEXT NOT NULL,
  "batchStockId"     TEXT NOT NULL,
  "quantity"         DECIMAL(65,30) NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kxtill_pharmacy_refund_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_refund_allocations_refundItemId_idx"
  ON "kxtill_pharmacy_refund_allocations"("refundItemId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_refund_allocations_saleAllocationId_idx"
  ON "kxtill_pharmacy_refund_allocations"("saleAllocationId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_refund_allocations_batchId_idx"
  ON "kxtill_pharmacy_refund_allocations"("batchId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_refund_allocations_batchStockId_idx"
  ON "kxtill_pharmacy_refund_allocations"("batchStockId");

-- 3. Foreign keys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_refund_allocations_refundItemId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_refund_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_refund_allocations_refundItemId_fkey"
      FOREIGN KEY ("refundItemId") REFERENCES "kxtill_sale_refund_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_refund_allocations_saleAllocationId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_refund_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_refund_allocations_saleAllocationId_fkey"
      FOREIGN KEY ("saleAllocationId") REFERENCES "kxtill_pharmacy_sale_batch_allocations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_refund_allocations_batchId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_refund_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_refund_allocations_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "kxtill_pharmacy_batches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_refund_allocations_batchStockId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_refund_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_refund_allocations_batchStockId_fkey"
      FOREIGN KEY ("batchStockId") REFERENCES "kxtill_pharmacy_batch_stock"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;