-- CreateTable
CREATE TABLE IF NOT EXISTS "pairing_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "branchId" TEXT,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pairing_sessions_tokenHash_key"
  ON "pairing_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pairing_sessions_userId_idx"
  ON "pairing_sessions"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pairing_sessions_expiresAt_idx"
  ON "pairing_sessions"("expiresAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pairing_sessions_userId_fkey'
  ) THEN
    ALTER TABLE "pairing_sessions"
      ADD CONSTRAINT "pairing_sessions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pairing_sessions_organizationId_fkey'
  ) THEN
    ALTER TABLE "pairing_sessions"
      ADD CONSTRAINT "pairing_sessions_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pairing_sessions_branchId_fkey'
  ) THEN
    ALTER TABLE "pairing_sessions"
      ADD CONSTRAINT "pairing_sessions_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;