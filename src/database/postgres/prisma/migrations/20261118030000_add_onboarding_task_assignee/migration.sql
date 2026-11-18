-- ============================================================
-- Add assignedToId to onboarding_tasks (for ad-hoc task assignment)
-- ============================================================

ALTER TABLE "onboarding_tasks"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

CREATE INDEX IF NOT EXISTS "onboarding_tasks_assignedToId_idx"
  ON "onboarding_tasks"("assignedToId");

DO $$ BEGIN
  ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;