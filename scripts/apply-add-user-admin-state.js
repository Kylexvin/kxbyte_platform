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
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verifiedAt"         TIMESTAMP(3);
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivatedAt"      TIMESTAMP(3);
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivatedBy"      TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivationReason" TEXT;
  `);

  await c.query(`
    UPDATE "users"
    SET "verifiedAt" = "updatedAt"
    WHERE "isEmailVerified" = true AND "verifiedAt" IS NULL;
  `);

  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(check.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}