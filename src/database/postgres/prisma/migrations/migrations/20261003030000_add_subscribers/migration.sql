-- Subscribers: public email list for newsletter + product waitlists.
-- Not org-scoped — this is a platform-level resource.

CREATE TABLE IF NOT EXISTS "subscribers" (
  "id"             TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "newsletter"     BOOLEAN NOT NULL DEFAULT false,
  "waitlists"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source"         TEXT,
  "ipAddress"      TEXT,
  "userAgent"      TEXT,
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_key"
  ON "subscribers"("email");

CREATE INDEX IF NOT EXISTS "subscribers_newsletter_idx"
  ON "subscribers"("newsletter");