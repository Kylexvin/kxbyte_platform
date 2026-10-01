-- ============================================================
-- KXTILL SHIFT MODULE
-- Migration: 20260930030000_add_kxtill_shift_module
-- ============================================================

-- ------------------------------------------------------------
-- 1. kxtill_branch_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "kxtill_branch_settings" (
  "id"                TEXT         NOT NULL,
  "branchId"          TEXT         NOT NULL,
  "shiftsEnabled"     BOOLEAN      NOT NULL DEFAULT false,
  "varianceThreshold" DECIMAL(65,30) NOT NULL DEFAULT 50,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_branch_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_branch_settings_branchId_key"
  ON "kxtill_branch_settings"("branchId");

-- ------------------------------------------------------------
-- 2. kxtill_shifts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "kxtill_shifts" (
  "id"                    TEXT         NOT NULL,
  "organizationId"        TEXT         NOT NULL,
  "branchId"              TEXT         NOT NULL,
  "userId"                TEXT         NOT NULL,
  "tillId"                TEXT,
  "status"                TEXT         NOT NULL DEFAULT 'OPEN',
  "closureType"           TEXT,
  "openingFloat"          DECIMAL(65,30) NOT NULL,
  "declaredCash"          DECIMAL(65,30),
  "expectedCash"          DECIMAL(65,30),
  "variance"              DECIMAL(65,30),
  "openedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"              TIMESTAMP(3),
  "openedById"            TEXT         NOT NULL,
  "closedById"            TEXT,
  "handoverRequestedById" TEXT,
  "handoverResolvedById"  TEXT,
  "handoverResolvedAt"    TIMESTAMP(3),
  "handoverNote"          TEXT,
  "varianceReviewedById"  TEXT,
  "varianceReviewedAt"    TIMESTAMP(3),
  "varianceNote"          TEXT,
  "deletedAt"             TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kxtill_shifts_organizationId_idx"
  ON "kxtill_shifts"("organizationId");

CREATE INDEX IF NOT EXISTS "kxtill_shifts_userId_idx"
  ON "kxtill_shifts"("userId");

CREATE INDEX IF NOT EXISTS "kxtill_shifts_status_idx"
  ON "kxtill_shifts"("status");

CREATE INDEX IF NOT EXISTS "kxtill_shifts_branchId_status_idx"
  ON "kxtill_shifts"("branchId", "status");

-- ------------------------------------------------------------
-- 3. kxtill_sales — add shift columns
-- ------------------------------------------------------------
ALTER TABLE "kxtill_sales"
  ADD COLUMN IF NOT EXISTS "shiftId" TEXT;

ALTER TABLE "kxtill_sales"
  ADD COLUMN IF NOT EXISTS "refundShiftId" TEXT;

CREATE INDEX IF NOT EXISTS "kxtill_sales_shiftId_idx"
  ON "kxtill_sales"("shiftId");

CREATE INDEX IF NOT EXISTS "kxtill_sales_refundShiftId_idx"
  ON "kxtill_sales"("refundShiftId");

-- ------------------------------------------------------------
-- 4. Foreign keys — kxtill_branch_settings
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_branch_settings_branchId_fkey'
  ) THEN
    ALTER TABLE "kxtill_branch_settings"
      ADD CONSTRAINT "kxtill_branch_settings_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Foreign keys — kxtill_shifts
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_organizationId_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_branchId_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_userId_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_openedById_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_openedById_fkey"
      FOREIGN KEY ("openedById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_closedById_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_handoverRequestedById_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_handoverRequestedById_fkey"
      FOREIGN KEY ("handoverRequestedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_handoverResolvedById_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_handoverResolvedById_fkey"
      FOREIGN KEY ("handoverResolvedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_shifts_varianceReviewedById_fkey'
  ) THEN
    ALTER TABLE "kxtill_shifts"
      ADD CONSTRAINT "kxtill_shifts_varianceReviewedById_fkey"
      FOREIGN KEY ("varianceReviewedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Foreign keys — kxtill_sales new columns
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sales_shiftId_fkey'
  ) THEN
    ALTER TABLE "kxtill_sales"
      ADD CONSTRAINT "kxtill_sales_shiftId_fkey"
      FOREIGN KEY ("shiftId") REFERENCES "kxtill_shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sales_refundShiftId_fkey'
  ) THEN
    ALTER TABLE "kxtill_sales"
      ADD CONSTRAINT "kxtill_sales_refundShiftId_fkey"
      FOREIGN KEY ("refundShiftId") REFERENCES "kxtill_shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;