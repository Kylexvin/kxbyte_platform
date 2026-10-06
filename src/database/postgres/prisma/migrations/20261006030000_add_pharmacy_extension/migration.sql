-- ============================================================
-- KXTILL PHARMACY VERTICAL - INITIAL SCHEMA
-- Adds 6 tables, all idempotent. Core tables are not modified.
-- ============================================================

-- 1. Pharmacy config (per organization)
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_config" (
  "id"                   TEXT NOT NULL,
  "organizationId"       TEXT NOT NULL,
  "isEnabled"            BOOLEAN NOT NULL DEFAULT true,
  "expiryWarningDays"    INTEGER NOT NULL DEFAULT 90,
  "blockExpiredSales"    BOOLEAN NOT NULL DEFAULT true,
  "requireBatchOnSale"   BOOLEAN NOT NULL DEFAULT true,
  "defaultDispensingUnit" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_pharmacy_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_pharmacy_config_organizationId_key"
  ON "kxtill_pharmacy_config"("organizationId");

-- 2. Pharmacy product identity
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_products" (
  "id"                   TEXT NOT NULL,
  "productId"            TEXT NOT NULL,
  "genericName"          TEXT,
  "brandName"            TEXT,
  "strength"             TEXT,
  "dosageForm"           TEXT,
  "route"                TEXT,
  "prescriptionCategory" TEXT,
  "packSize"             TEXT,
  "storageConditions"    TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_pharmacy_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_pharmacy_products_productId_key"
  ON "kxtill_pharmacy_products"("productId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_products_genericName_idx"
  ON "kxtill_pharmacy_products"("genericName");

-- 3. Pharmacy batches
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_batches" (
  "id"             TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "batchNumber"    TEXT NOT NULL,
  "expiryDate"     TIMESTAMP(3) NOT NULL,
  "manufacturedAt" TIMESTAMP(3),
  "manufacturer"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_pharmacy_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_pharmacy_batches_productId_batchNumber_expiryDate_key"
  ON "kxtill_pharmacy_batches"("productId", "batchNumber", "expiryDate");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_batches_productId_idx"
  ON "kxtill_pharmacy_batches"("productId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_batches_expiryDate_idx"
  ON "kxtill_pharmacy_batches"("expiryDate");

-- 4. Pharmacy batch stock (per branch)
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_batch_stock" (
  "id"              TEXT NOT NULL,
  "batchId"         TEXT NOT NULL,
  "branchProductId" TEXT NOT NULL,
  "quantityOnHand"  DECIMAL(65,30) NOT NULL DEFAULT 0,
  "unitCost"        DECIMAL(65,30) NOT NULL DEFAULT 0,
  "sellingPrice"    DECIMAL(65,30),
  "status"          TEXT NOT NULL DEFAULT 'AVAILABLE',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_pharmacy_batch_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_pharmacy_batch_stock_batchId_branchProductId_key"
  ON "kxtill_pharmacy_batch_stock"("batchId", "branchProductId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_batch_stock_branchProductId_idx"
  ON "kxtill_pharmacy_batch_stock"("branchProductId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_batch_stock_status_idx"
  ON "kxtill_pharmacy_batch_stock"("status");

-- 5. Sale → batch allocation
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_sale_batch_allocations" (
  "id"           TEXT NOT NULL,
  "saleItemId"   TEXT NOT NULL,
  "batchStockId" TEXT NOT NULL,
  "batchId"      TEXT NOT NULL,
  "quantity"     DECIMAL(65,30) NOT NULL,
  "unitCost"     DECIMAL(65,30) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kxtill_pharmacy_sale_batch_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_sale_batch_allocations_saleItemId_idx"
  ON "kxtill_pharmacy_sale_batch_allocations"("saleItemId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_sale_batch_allocations_batchStockId_idx"
  ON "kxtill_pharmacy_sale_batch_allocations"("batchStockId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_sale_batch_allocations_batchId_idx"
  ON "kxtill_pharmacy_sale_batch_allocations"("batchId");

-- 6. Stock movements (audit trail)
CREATE TABLE IF NOT EXISTS "kxtill_pharmacy_stock_movements" (
  "id"            TEXT NOT NULL,
  "batchStockId"  TEXT NOT NULL,
  "batchId"       TEXT NOT NULL,
  "movementType"  TEXT NOT NULL,
  "quantity"      DECIMAL(65,30) NOT NULL,
  "reason"        TEXT,
  "referenceId"   TEXT,
  "referenceType" TEXT,
  "userId"        TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kxtill_pharmacy_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_stock_movements_batchStockId_idx"
  ON "kxtill_pharmacy_stock_movements"("batchStockId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_stock_movements_batchId_idx"
  ON "kxtill_pharmacy_stock_movements"("batchId");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_stock_movements_movementType_idx"
  ON "kxtill_pharmacy_stock_movements"("movementType");

CREATE INDEX IF NOT EXISTS "kxtill_pharmacy_stock_movements_referenceId_idx"
  ON "kxtill_pharmacy_stock_movements"("referenceId");

-- ============================================================
-- FOREIGN KEYS (idempotent via DO blocks)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_config_organizationId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_config"
      ADD CONSTRAINT "kxtill_pharmacy_config_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_products_productId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_products"
      ADD CONSTRAINT "kxtill_pharmacy_products_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "kxtill_products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_batches_productId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_batches"
      ADD CONSTRAINT "kxtill_pharmacy_batches_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "kxtill_products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_batch_stock_batchId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_batch_stock"
      ADD CONSTRAINT "kxtill_pharmacy_batch_stock_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "kxtill_pharmacy_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_batch_stock_branchProductId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_batch_stock"
      ADD CONSTRAINT "kxtill_pharmacy_batch_stock_branchProductId_fkey"
      FOREIGN KEY ("branchProductId") REFERENCES "kxtill_branch_products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_sale_batch_allocations_saleItemId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_sale_batch_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_sale_batch_allocations_saleItemId_fkey"
      FOREIGN KEY ("saleItemId") REFERENCES "kxtill_sale_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_sale_batch_allocations_batchStockId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_sale_batch_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_sale_batch_allocations_batchStockId_fkey"
      FOREIGN KEY ("batchStockId") REFERENCES "kxtill_pharmacy_batch_stock"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_sale_batch_allocations_batchId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_sale_batch_allocations"
      ADD CONSTRAINT "kxtill_pharmacy_sale_batch_allocations_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "kxtill_pharmacy_batches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_stock_movements_batchStockId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_stock_movements"
      ADD CONSTRAINT "kxtill_pharmacy_stock_movements_batchStockId_fkey"
      FOREIGN KEY ("batchStockId") REFERENCES "kxtill_pharmacy_batch_stock"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_stock_movements_batchId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_stock_movements"
      ADD CONSTRAINT "kxtill_pharmacy_stock_movements_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "kxtill_pharmacy_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_stock_movements_userId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_stock_movements"
      ADD CONSTRAINT "kxtill_pharmacy_stock_movements_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;