-- ============================================================
-- billing_config: singleton row holding platform-wide payment
-- plumbing (paybill, bank, contact, grace/trial defaults).
-- Replaces hardcoded PAYMENT object in kxtill billing.service.js.
-- ============================================================

CREATE TABLE IF NOT EXISTS "billing_config" (
  "id"              TEXT NOT NULL,
  "paybill"         TEXT,
  "tillNumber"      TEXT,
  "mpesaPhone"      TEXT,
  "bankName"        TEXT,
  "bankAccount"     TEXT,
  "bankAccountName" TEXT,
  "contactEmail"    TEXT,
  "contactPhone"    TEXT,
  "accountPrefix"   TEXT NOT NULL DEFAULT 'KXBYTE-',
  "graceDays"       INTEGER NOT NULL DEFAULT 2,
  "trialDays"       INTEGER NOT NULL DEFAULT 21,
  "updatedById"     TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_config_pkey" PRIMARY KEY ("id")
);