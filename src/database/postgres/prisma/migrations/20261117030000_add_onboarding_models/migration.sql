-- ============================================================
-- Onboarding: organization_onboardings + onboarding_tasks
-- Admin-only monitoring of customer onboarding per product.
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingTaskCategory" AS ENUM (
    'ACCOUNT_SETUP', 'CONFIGURATION', 'TRAINING', 'COMMERCIAL', 'ADOPTION', 'HANDOVER', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- organization_onboardings
CREATE TABLE IF NOT EXISTS "organization_onboardings" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productKey"     TEXT NOT NULL,
  "templateKey"    TEXT NOT NULL,
  "status"         "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "ownerId"        TEXT,
  "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_onboardings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_onboardings_organizationId_productKey_key"
  ON "organization_onboardings"("organizationId", "productKey");
CREATE INDEX IF NOT EXISTS "organization_onboardings_organizationId_idx"
  ON "organization_onboardings"("organizationId");
CREATE INDEX IF NOT EXISTS "organization_onboardings_status_idx"
  ON "organization_onboardings"("status");
CREATE INDEX IF NOT EXISTS "organization_onboardings_ownerId_idx"
  ON "organization_onboardings"("ownerId");

-- onboarding_tasks
CREATE TABLE IF NOT EXISTS "onboarding_tasks" (
  "id"             TEXT NOT NULL,
  "onboardingId"   TEXT,
  "organizationId" TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "category"       "OnboardingTaskCategory" NOT NULL DEFAULT 'GENERAL',
  "source"         TEXT NOT NULL,
  "autoCheck"      TEXT,
  "required"       BOOLEAN NOT NULL DEFAULT true,
  "status"         "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt"          TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "completedById"  TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "onboarding_tasks_organizationId_idx"
  ON "onboarding_tasks"("organizationId");
CREATE INDEX IF NOT EXISTS "onboarding_tasks_onboardingId_idx"
  ON "onboarding_tasks"("onboardingId");
CREATE INDEX IF NOT EXISTS "onboarding_tasks_status_idx"
  ON "onboarding_tasks"("status");
CREATE INDEX IF NOT EXISTS "onboarding_tasks_dueAt_idx"
  ON "onboarding_tasks"("dueAt");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "organization_onboardings"
    ADD CONSTRAINT "organization_onboardings_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_onboardings"
    ADD CONSTRAINT "organization_onboardings_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_onboardingId_fkey"
    FOREIGN KEY ("onboardingId") REFERENCES "organization_onboardings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;