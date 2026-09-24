-- Add auditLogRetention column to organizations table.
-- Per-org audit log retention in days. Valid values enforced at the
-- application layer: 30, 45, 60, 90. Default 45.

ALTER TABLE "organizations"
ADD COLUMN "auditLogRetention" INTEGER NOT NULL DEFAULT 45;