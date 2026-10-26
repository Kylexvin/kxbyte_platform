// scripts/apply-device-tokens.js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS "device_tokens" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "productKey" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "platform" TEXT NOT NULL,
      "deviceLabel" TEXT,
      "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key"
      ON "device_tokens"("token");
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS "device_tokens_userId_productKey_idx"
      ON "device_tokens"("userId", "productKey");
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS "device_tokens_productKey_idx"
      ON "device_tokens"("productKey");
  `);

  await c.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_tokens_userId_fkey'
      ) THEN
        ALTER TABLE "device_tokens"
          ADD CONSTRAINT "device_tokens_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'device_tokens'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(cols.rows);

  const idx = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'device_tokens'
    ORDER BY indexname
  `);
  console.log('INDEXES:');
  console.table(idx.rows);

  const fks = await c.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'device_tokens'::regclass AND contype = 'f'
    ORDER BY conname
  `);
  console.log('FOREIGN KEYS:');
  console.table(fks.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}