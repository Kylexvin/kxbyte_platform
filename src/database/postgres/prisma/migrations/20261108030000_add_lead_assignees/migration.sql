-- ============================================================
-- lead_assignees: multi-assignee support for leads
-- Drops leads.assignedToId (single-assignee), adds junction table.
-- ============================================================

CREATE TABLE IF NOT EXISTS "lead_assignees" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId"         TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "assignedById"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_assignees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_assignees_leadId_userId_key"
  ON "lead_assignees"("leadId", "userId");
CREATE INDEX IF NOT EXISTS "lead_assignees_organizationId_userId_idx"
  ON "lead_assignees"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "lead_assignees_organizationId_leadId_idx"
  ON "lead_assignees"("organizationId", "leadId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "lead_assignees"
    ADD CONSTRAINT "lead_assignees_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lead_assignees"
    ADD CONSTRAINT "lead_assignees_leadId_fkey"
    FOREIGN KEY ("organizationId", "leadId")
    REFERENCES "leads"("organizationId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lead_assignees"
    ADD CONSTRAINT "lead_assignees_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lead_assignees"
    ADD CONSTRAINT "lead_assignees_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop the old single-assignee column + index (safe: no non-null values).
ALTER TABLE "leads" DROP COLUMN IF EXISTS "assignedToId";
DROP INDEX IF EXISTS "leads_organizationId_assignedToId_idx";