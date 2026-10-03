-- ============================================================
-- CUSTOMER CREDIT LEDGER (DENI)
-- Migration: 20261002030000_add_customer_credit_ledger
-- ============================================================

-- ------------------------------------------------------------
-- 1. customer_credit_ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "customer_credit_ledger" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "customerId"     TEXT         NOT NULL,
  "branchId"       TEXT,
  "type"           TEXT         NOT NULL,
  "amount"         DECIMAL(65,30) NOT NULL,
  "saleId"         TEXT,
  "shiftId"        TEXT,
  "note"           TEXT,
  "createdById"    TEXT         NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_organizationId_idx"
  ON "customer_credit_ledger"("organizationId");

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_customerId_idx"
  ON "customer_credit_ledger"("customerId");

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_customerId_createdAt_idx"
  ON "customer_credit_ledger"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_type_idx"
  ON "customer_credit_ledger"("type");

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_saleId_idx"
  ON "customer_credit_ledger"("saleId");

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_shiftId_idx"
  ON "customer_credit_ledger"("shiftId");

-- ------------------------------------------------------------
-- 2. customers — add creditLimit
-- ------------------------------------------------------------
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(65,30);

-- ------------------------------------------------------------
-- 3. kxtill_branch_settings — add creditEnabled
-- ------------------------------------------------------------
ALTER TABLE "kxtill_branch_settings"
  ADD COLUMN IF NOT EXISTS "creditEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 4. kxtill_sale_payments — add creditLedgerId
-- ------------------------------------------------------------
ALTER TABLE "kxtill_sale_payments"
  ADD COLUMN IF NOT EXISTS "creditLedgerId" TEXT;

CREATE INDEX IF NOT EXISTS "kxtill_sale_payments_creditLedgerId_idx"
  ON "kxtill_sale_payments"("creditLedgerId");

-- ------------------------------------------------------------
-- 5. Foreign keys
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_organizationId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_customerId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_branchId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_saleId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "kxtill_sales"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_shiftId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_shiftId_fkey"
      FOREIGN KEY ("shiftId") REFERENCES "kxtill_shifts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_createdById_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sale_payments_creditLedgerId_fkey') THEN
    ALTER TABLE "kxtill_sale_payments"
      ADD CONSTRAINT "kxtill_sale_payments_creditLedgerId_fkey"
      FOREIGN KEY ("creditLedgerId") REFERENCES "customer_credit_ledger"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;