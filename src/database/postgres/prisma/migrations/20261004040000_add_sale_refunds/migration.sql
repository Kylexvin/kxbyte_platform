-- ============================================================
-- ADD SALE REFUNDS (PARTIAL REFUND SUPPORT)
-- Migration: 20261004040000_add_sale_refunds
-- ============================================================

-- ------------------------------------------------------------
-- 1. kxtill_sale_refunds
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "kxtill_sale_refunds" (
  "id"             TEXT         NOT NULL,
  "reference"      TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "saleId"         TEXT         NOT NULL,
  "branchId"       TEXT         NOT NULL,
  "shiftId"        TEXT,
  "userId"         TEXT         NOT NULL,
  "totalAmount"    DECIMAL(65,30) NOT NULL,
  "cashAmount"     DECIMAL(65,30) NOT NULL DEFAULT 0,
  "creditAmount"   DECIMAL(65,30) NOT NULL DEFAULT 0,
  "otherAmount"    DECIMAL(65,30) NOT NULL DEFAULT 0,
  "reason"         TEXT,
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kxtill_sale_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_sale_refunds_reference_key"
  ON "kxtill_sale_refunds"("reference");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_organizationId_idx"
  ON "kxtill_sale_refunds"("organizationId");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_saleId_idx"
  ON "kxtill_sale_refunds"("saleId");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_branchId_idx"
  ON "kxtill_sale_refunds"("branchId");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_shiftId_idx"
  ON "kxtill_sale_refunds"("shiftId");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_createdAt_idx"
  ON "kxtill_sale_refunds"("createdAt");

-- ------------------------------------------------------------
-- 2. kxtill_sale_refund_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "kxtill_sale_refund_items" (
  "id"         TEXT         NOT NULL,
  "refundId"   TEXT         NOT NULL,
  "saleItemId" TEXT         NOT NULL,
  "quantity"   DECIMAL(65,30) NOT NULL,
  "unitPrice"  DECIMAL(65,30) NOT NULL,
  "total"      DECIMAL(65,30) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kxtill_sale_refund_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kxtill_sale_refund_items_refundId_idx"
  ON "kxtill_sale_refund_items"("refundId");

CREATE INDEX IF NOT EXISTS "kxtill_sale_refund_items_saleItemId_idx"
  ON "kxtill_sale_refund_items"("saleItemId");

-- ------------------------------------------------------------
-- 3. kxtill_sales — add refundedAmount
-- ------------------------------------------------------------
ALTER TABLE "kxtill_sales"
  ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 4. Foreign keys
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refunds_organizationId_fkey') THEN
    ALTER TABLE "kxtill_sale_refunds"
      ADD CONSTRAINT "kxtill_sale_refunds_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refunds_saleId_fkey') THEN
    ALTER TABLE "kxtill_sale_refunds"
      ADD CONSTRAINT "kxtill_sale_refunds_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "kxtill_sales"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refunds_branchId_fkey') THEN
    ALTER TABLE "kxtill_sale_refunds"
      ADD CONSTRAINT "kxtill_sale_refunds_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refunds_shiftId_fkey') THEN
    ALTER TABLE "kxtill_sale_refunds"
      ADD CONSTRAINT "kxtill_sale_refunds_shiftId_fkey"
      FOREIGN KEY ("shiftId") REFERENCES "kxtill_shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refunds_userId_fkey') THEN
    ALTER TABLE "kxtill_sale_refunds"
      ADD CONSTRAINT "kxtill_sale_refunds_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refund_items_refundId_fkey') THEN
    ALTER TABLE "kxtill_sale_refund_items"
      ADD CONSTRAINT "kxtill_sale_refund_items_refundId_fkey"
      FOREIGN KEY ("refundId") REFERENCES "kxtill_sale_refunds"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_refund_items_saleItemId_fkey') THEN
    ALTER TABLE "kxtill_sale_refund_items"
      ADD CONSTRAINT "kxtill_sale_refund_items_saleItemId_fkey"
      FOREIGN KEY ("saleItemId") REFERENCES "kxtill_sale_items"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;