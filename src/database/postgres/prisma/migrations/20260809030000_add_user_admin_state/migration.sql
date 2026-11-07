-- Add user admin-state columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verifiedAt"         TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivatedAt"      TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivatedBy"      TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;

-- Backfill: existing verified users get verifiedAt = updatedAt
UPDATE "users"
SET "verifiedAt" = "updatedAt"
WHERE "isEmailVerified" = true AND "verifiedAt" IS NULL;