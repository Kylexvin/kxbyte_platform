-- ============================================================
-- M-Pesa (Daraja) platform-level integration
-- Adds two tables:
--   - kx_mpesa_configs        per-org Daraja credentials + callback token
--   - kx_mpesa_transactions   STK push transactions
-- ============================================================

-- 1. Per-org M-Pesa config
CREATE TABLE IF NOT EXISTS "kx_mpesa_configs" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "environment"       TEXT NOT NULL,
  "consumerKeyEnc"    TEXT NOT NULL,
  "consumerSecretEnc" TEXT NOT NULL,
  "passkeyEnc"        TEXT NOT NULL,
  "shortcode"         TEXT NOT NULL,
  "callbackToken"     TEXT NOT NULL,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "lastTestedAt"      TIMESTAMP(3),
  "lastTestResult"    TEXT DEFAULT 'UNTESTED',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kx_mpesa_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kx_mpesa_configs_organizationId_key"
  ON "kx_mpesa_configs"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "kx_mpesa_configs_callbackToken_key"
  ON "kx_mpesa_configs"("callbackToken");

CREATE INDEX IF NOT EXISTS "kx_mpesa_configs_organizationId_idx"
  ON "kx_mpesa_configs"("organizationId");

-- 2. M-Pesa transactions
CREATE TABLE IF NOT EXISTS "kx_mpesa_transactions" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "referenceType"       TEXT NOT NULL,
  "referenceId"         TEXT NOT NULL,
  "productKey"          TEXT,
  "merchantRef"         TEXT NOT NULL,
  "checkoutRequestId"   TEXT,
  "merchantRequestId"   TEXT,
  "mpesaReceiptNumber"  TEXT,
  "amount"              DECIMAL(65,30) NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'KES',
  "phone"               TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "stkResponse"         JSONB,
  "callbackPayload"     JSONB,
  "failureReason"       TEXT,
  "completedAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kx_mpesa_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kx_mpesa_transactions_merchantRef_key"
  ON "kx_mpesa_transactions"("merchantRef");

CREATE UNIQUE INDEX IF NOT EXISTS "kx_mpesa_transactions_checkoutRequestId_key"
  ON "kx_mpesa_transactions"("checkoutRequestId");

CREATE INDEX IF NOT EXISTS "kx_mpesa_transactions_organizationId_idx"
  ON "kx_mpesa_transactions"("organizationId");

CREATE INDEX IF NOT EXISTS "kx_mpesa_transactions_referenceType_referenceId_idx"
  ON "kx_mpesa_transactions"("referenceType", "referenceId");

CREATE INDEX IF NOT EXISTS "kx_mpesa_transactions_status_idx"
  ON "kx_mpesa_transactions"("status");

CREATE INDEX IF NOT EXISTS "kx_mpesa_transactions_createdAt_idx"
  ON "kx_mpesa_transactions"("createdAt");

-- 3. Foreign keys (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kx_mpesa_configs_organizationId_fkey') THEN
    ALTER TABLE "kx_mpesa_configs"
      ADD CONSTRAINT "kx_mpesa_configs_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kx_mpesa_transactions_organizationId_fkey') THEN
    ALTER TABLE "kx_mpesa_transactions"
      ADD CONSTRAINT "kx_mpesa_transactions_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;