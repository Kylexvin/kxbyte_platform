-- Add logoPublicId to organizations.
-- Stores the Cloudinary public_id so we can delete the previous
-- logo asset when a new one is uploaded.

ALTER TABLE "organizations"
ADD COLUMN "logoPublicId" TEXT;