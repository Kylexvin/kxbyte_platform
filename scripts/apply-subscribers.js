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
  `);

  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_key"
      ON "subscribers"("email");
  `);

  await c.query(`
    CREATE INDEX IF NOT EXISTS "subscribers_newsletter_idx"
      ON "subscribers"("newsletter");
  `);

  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'subscribers'
    ORDER BY ordinal_position
  `);

  console.log('APPLIED. Columns:');
  console.table(check.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}