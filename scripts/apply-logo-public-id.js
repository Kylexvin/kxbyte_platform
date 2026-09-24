// scripts/apply-logo-public-id.js

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
    ADD COLUMN IF NOT EXISTS "logoPublicId" TEXT;
  `);

  const res = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'organizations'
      AND column_name = 'logoPublicId'
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