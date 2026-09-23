-- Add branchIds array column to invitations table.
-- Nullable by nature (Postgres arrays default to empty), no backfill needed.

ALTER TABLE "invitations"
ADD COLUMN "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];