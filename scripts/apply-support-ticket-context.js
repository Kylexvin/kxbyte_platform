// scripts/apply-support-ticket-context.js

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
  ALTER TABLE "support_tickets"
    ADD COLUMN IF NOT EXISTS "contextId"       TEXT,
    ADD COLUMN IF NOT EXISTS "contextType"     TEXT,
    ADD COLUMN IF NOT EXISTS "assigneeId"      TEXT,
    ADD COLUMN IF NOT EXISTS "escalatedAt"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "escalatedById"   TEXT,
    ADD COLUMN IF NOT EXISTS "escalatedToId"   TEXT,
    ADD COLUMN IF NOT EXISTS "escalatedToType" TEXT,
    ADD COLUMN IF NOT EXISTS "resolutionNote"  TEXT,
    ADD COLUMN IF NOT EXISTS "resolvedById"    TEXT;
`;

const fk = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'support_tickets_assigneeId_fkey'
    ) THEN
      ALTER TABLE "support_tickets"
        ADD CONSTRAINT "support_tickets_assigneeId_fkey"
        FOREIGN KEY ("assigneeId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;
`;

const indexes = `
  CREATE INDEX IF NOT EXISTS "support_tickets_assigneeId_idx"  ON "support_tickets"("assigneeId");
  CREATE INDEX IF NOT EXISTS "support_tickets_contextId_idx"   ON "support_tickets"("contextId");
  CREATE INDEX IF NOT EXISTS "support_tickets_contextType_idx" ON "support_tickets"("contextType");
`;

try {
  await c.connect();

  await c.query(sql);
  await c.query(fk);
  await c.query(indexes);

  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'support_tickets'
      AND column_name IN (
        'contextId','contextType','assigneeId',
        'escalatedAt','escalatedById','escalatedToId','escalatedToType',
        'resolutionNote','resolvedById'
      )
    ORDER BY column_name
  `);

  console.log('APPLIED. New columns:');
  console.table(check.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}