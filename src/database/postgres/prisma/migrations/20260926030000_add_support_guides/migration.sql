-- SupportGuide: FAQ / how-to entries scoped to an organization.
-- All fields except createdById and organizationId are optional or
-- have defaults. No data migration required.

CREATE TABLE "support_guides" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById"    TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "summary"        TEXT NOT NULL,
  "body"           TEXT,
  "url"            TEXT,
  "category"       TEXT NOT NULL,
  "productKey"     TEXT,
  "isPublished"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_guides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_guides_organizationId_idx"
  ON "support_guides"("organizationId");

ALTER TABLE "support_guides"
  ADD CONSTRAINT "support_guides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_guides"
  ADD CONSTRAINT "support_guides_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;