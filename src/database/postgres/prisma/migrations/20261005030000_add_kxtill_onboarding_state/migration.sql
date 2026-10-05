-- ============================================================
-- KXTILL ONBOARDING STATE
-- Migration: 20261005030000_add_kxtill_onboarding_state
-- ============================================================

CREATE TABLE IF NOT EXISTS "kxtill_onboarding_state" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "isDismissed"    BOOLEAN      NOT NULL DEFAULT false,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kxtill_onboarding_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_onboarding_state_organizationId_key"
  ON "kxtill_onboarding_state"("organizationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_onboarding_state_organizationId_fkey') THEN
    ALTER TABLE "kxtill_onboarding_state"
      ADD CONSTRAINT "kxtill_onboarding_state_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;