-- ============================================================
-- KxCRM models: pipeline_stages, leads, lead_activities
-- ============================================================

-- PipelineStage
CREATE TABLE IF NOT EXISTS "pipeline_stages" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "order"          INTEGER NOT NULL,
  "isTerminal"     BOOLEAN NOT NULL DEFAULT false,
  "isWon"          BOOLEAN NOT NULL DEFAULT false,
  "isLost"         BOOLEAN NOT NULL DEFAULT false,
  "color"          TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_organizationId_id_key"
  ON "pipeline_stages"("organizationId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_organizationId_key_key"
  ON "pipeline_stages"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "pipeline_stages_organizationId_order_idx"
  ON "pipeline_stages"("organizationId", "order");
CREATE INDEX IF NOT EXISTS "pipeline_stages_organizationId_isActive_idx"
  ON "pipeline_stages"("organizationId", "isActive");

-- Lead
CREATE TABLE IF NOT EXISTS "leads" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "businessName"            TEXT NOT NULL,
  "businessCategory"        TEXT,
  "contactName"             TEXT NOT NULL,
  "contactEmail"            TEXT,
  "contactPhone"            TEXT NOT NULL,
  "location"                TEXT,
  "businessSize"            TEXT,
  "interestedProduct"       TEXT,
  "source"                  TEXT NOT NULL,
  "sourceDetail"            TEXT,
  "stageId"                 TEXT NOT NULL,
  "dealValue"               DECIMAL(12,2),
  "currency"                TEXT NOT NULL DEFAULT 'KES',
  "assignedToId"            TEXT,
  "convertedOrganizationId" TEXT,
  "convertedAt"             TIMESTAMP(3),
  "convertedById"           TEXT,
  "lostReason"              TEXT,
  "lostAt"                  TIMESTAMP(3),
  "notes"                   TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "deletedAt"               TIMESTAMP(3),
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leads_organizationId_id_key"
  ON "leads"("organizationId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_convertedOrganizationId_key"
  ON "leads"("convertedOrganizationId");
CREATE INDEX IF NOT EXISTS "leads_organizationId_stageId_idx"
  ON "leads"("organizationId", "stageId");
CREATE INDEX IF NOT EXISTS "leads_organizationId_assignedToId_idx"
  ON "leads"("organizationId", "assignedToId");
CREATE INDEX IF NOT EXISTS "leads_organizationId_createdAt_idx"
  ON "leads"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "leads_organizationId_deletedAt_idx"
  ON "leads"("organizationId", "deletedAt");
CREATE INDEX IF NOT EXISTS "leads_organizationId_convertedOrganizationId_idx"
  ON "leads"("organizationId", "convertedOrganizationId");

-- LeadActivity
CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "leadId"              TEXT NOT NULL,
  "userId"              TEXT,
  "type"                TEXT NOT NULL,
  "summary"             TEXT NOT NULL,
  "outcome"             TEXT,
  "nextStep"            TEXT,
  "nextStepDate"        TIMESTAMP(3),
  "visitObjections"     TEXT,
  "visitDemoRequested"  BOOLEAN NOT NULL DEFAULT false,
  "metadata"            JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lead_activities_organizationId_leadId_createdAt_idx"
  ON "lead_activities"("organizationId", "leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "lead_activities_organizationId_userId_createdAt_idx"
  ON "lead_activities"("organizationId", "userId", "createdAt");

-- ============================================================
-- Foreign keys
-- ============================================================

-- pipeline_stages.organizationId -> organizations.id  (CASCADE)
DO $$ BEGIN
  ALTER TABLE "pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads.organizationId -> organizations.id  (CASCADE)
DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads.(organizationId, stageId) -> pipeline_stages.(organizationId, id)  (RESTRICT)
DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_organizationId_stageId_fkey"
    FOREIGN KEY ("organizationId", "stageId")
    REFERENCES "pipeline_stages"("organizationId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads.assignedToId -> users.id  (SET NULL)
DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads.convertedOrganizationId -> organizations.id  (SET NULL)
DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_convertedOrganizationId_fkey"
    FOREIGN KEY ("convertedOrganizationId") REFERENCES "organizations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads.convertedById -> users.id  (SET NULL)
DO $$ BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_convertedById_fkey"
    FOREIGN KEY ("convertedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lead_activities.organizationId -> organizations.id  (CASCADE)
DO $$ BEGIN
  ALTER TABLE "lead_activities"
    ADD CONSTRAINT "lead_activities_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lead_activities.(organizationId, leadId) -> leads.(organizationId, id)  (CASCADE)
DO $$ BEGIN
  ALTER TABLE "lead_activities"
    ADD CONSTRAINT "lead_activities_organizationId_leadId_fkey"
    FOREIGN KEY ("organizationId", "leadId")
    REFERENCES "leads"("organizationId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- lead_activities.userId -> users.id  (SET NULL)
DO $$ BEGIN
  ALTER TABLE "lead_activities"
    ADD CONSTRAINT "lead_activities_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;