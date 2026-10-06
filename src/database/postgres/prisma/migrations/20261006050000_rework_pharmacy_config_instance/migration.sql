-- ============================================================
-- Rework: KxTillPharmacyConfig belongs to ProductInstance,
-- not to Organization directly.
-- ============================================================

-- 1. New table: product_instances
CREATE TABLE IF NOT EXISTS "product_instances" (
  "id"                    TEXT NOT NULL,
  "organizationProductId" TEXT NOT NULL,
  "vertical"              TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_instances_organizationProductId_vertical_name_key"
  ON "product_instances"("organizationProductId", "vertical", "name");

CREATE INDEX IF NOT EXISTS "product_instances_organizationProductId_idx"
  ON "product_instances"("organizationProductId");

CREATE INDEX IF NOT EXISTS "product_instances_vertical_idx"
  ON "product_instances"("vertical");

-- 2. Add new column to kxtill_pharmacy_config (nullable at first)
ALTER TABLE "kxtill_pharmacy_config"
  ADD COLUMN IF NOT EXISTS "productInstanceId" TEXT;

-- 3. Drop old organizationId column and its unique index + FK
DROP INDEX IF EXISTS "kxtill_pharmacy_config_organizationId_key";

ALTER TABLE "kxtill_pharmacy_config"
  DROP CONSTRAINT IF EXISTS "kxtill_pharmacy_config_organizationId_fkey";

ALTER TABLE "kxtill_pharmacy_config"
  DROP COLUMN IF EXISTS "organizationId";

-- 4. Enforce NOT NULL + unique on productInstanceId
--    (safe because the table is empty)
ALTER TABLE "kxtill_pharmacy_config"
  ALTER COLUMN "productInstanceId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_pharmacy_config_productInstanceId_key"
  ON "kxtill_pharmacy_config"("productInstanceId");

-- 5. Foreign keys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_instances_organizationProductId_fkey') THEN
    ALTER TABLE "product_instances"
      ADD CONSTRAINT "product_instances_organizationProductId_fkey"
      FOREIGN KEY ("organizationProductId") REFERENCES "organization_products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_pharmacy_config_productInstanceId_fkey') THEN
    ALTER TABLE "kxtill_pharmacy_config"
      ADD CONSTRAINT "kxtill_pharmacy_config_productInstanceId_fkey"
      FOREIGN KEY ("productInstanceId") REFERENCES "product_instances"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;