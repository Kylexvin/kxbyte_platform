import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'src/database/postgres/prisma/migrations/20261114030000_add_billing_config/migration.sql'
  ),
  'utf8'
);

try {
  await c.connect();
  await c.query(sql);

  const cols = await c.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'billing_config'
     ORDER BY ordinal_position`
  );
  console.log('\nAPPLIED. billing_config columns:');
  console.table(cols.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}