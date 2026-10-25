// scripts/apply-pairing-session.js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  // 1. CREATE TABLE
  await c.query(`
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
  `);

  // 2. Indexes
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "pairing_sessions_tokenHash_key"
      ON "pairing_sessions"("tokenHash");
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS "pairing_sessions_userId_idx"
      ON "pairing_sessions"("userId");
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS "pairing_sessions_expiresAt_idx"
      ON "pairing_sessions"("expiresAt");
  `);

  // 3. Foreign keys (guarded)
  await c.query(`
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
  `);
  await c.query(`
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
  `);
  await c.query(`
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
  `);

  // 4. Verify
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'pairing_sessions'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(cols.rows);

  const idx = await c.query(`
    SELECT indexname FROM pg_indexes WHERE tablename = 'pairing_sessions' ORDER BY indexname
  `);
  console.log('INDEXES:');
  console.table(idx.rows);

  const fks = await c.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'pairing_sessions'::regclass AND contype = 'f'
    ORDER BY conname
  `);
  console.log('FOREIGN KEYS:');
  console.table(fks.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}