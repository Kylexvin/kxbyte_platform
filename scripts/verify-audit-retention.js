// scripts/apply-audit-retention.js

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
    ALTER TABLE "organizations"
    ADD COLUMN IF NOT EXISTS "auditLogRetention" INTEGER NOT NULL DEFAULT 45;
  `);

  const res = await c.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'organizations'
      AND column_name = 'auditLogRetention'
  `);

  if (res.rows.length === 0) {
    console.log('FAIL: column still missing');
  } else {
    console.log('APPLIED:', res.rows[0]);
  }
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}