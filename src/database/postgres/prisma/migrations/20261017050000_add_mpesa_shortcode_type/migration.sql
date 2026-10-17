-- ============================================================
-- Add shortcodeType to kx_mpesa_configs
-- PAYBILL (default) | TILL
-- ============================================================

ALTER TABLE "kx_mpesa_configs"
  ADD COLUMN IF NOT EXISTS "shortcodeType" TEXT NOT NULL DEFAULT 'PAYBILL';