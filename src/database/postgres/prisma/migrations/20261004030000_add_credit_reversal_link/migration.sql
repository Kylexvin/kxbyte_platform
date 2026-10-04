-- ============================================================
-- ADD REVERSAL LINK TO CUSTOMER CREDIT LEDGER
-- Migration: 20261004030000_add_credit_reversal_link
-- ============================================================

ALTER TABLE "customer_credit_ledger"
  ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;

CREATE INDEX IF NOT EXISTS "customer_credit_ledger_reversalOfId_idx"
  ON "customer_credit_ledger"("reversalOfId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_reversalOfId_fkey') THEN
    ALTER TABLE "customer_credit_ledger"
      ADD CONSTRAINT "customer_credit_ledger_reversalOfId_fkey"
      FOREIGN KEY ("reversalOfId") REFERENCES "customer_credit_ledger"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;