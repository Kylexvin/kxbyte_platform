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
    CREATE TABLE IF NOT EXISTS "support_guides" (
      "id"             TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "createdById"    TEXT NOT NULL,
      "title"          TEXT NOT NULL,
      "summary"        TEXT NOT NULL,
      "body"           TEXT,
      "url"            TEXT,
      "category"       TEXT NOT NULL,
      "productKey"     TEXT,
      "isPublished"    BOOLEAN NOT NULL DEFAULT true,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      TIMESTAMP(3) NOT NULL,
      CONSTRAINT "support_guides_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`
    CREATE INDEX IF NOT EXISTS "support_guides_organizationId_idx"
    ON "support_guides"("organizationId");
  `);

  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'support_guides_organizationId_fkey'
      ) THEN
        ALTER TABLE "support_guides"
          ADD CONSTRAINT "support_guides_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'support_guides_createdById_fkey'
      ) THEN
        ALTER TABLE "support_guides"
          ADD CONSTRAINT "support_guides_createdById_fkey"
          FOREIGN KEY ("createdById") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // Verify
  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'support_guides'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(check.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}