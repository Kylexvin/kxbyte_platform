import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const sqlPath = path.resolve(
  'src/database/postgres/prisma/migrations/20261017050000_add_mpesa_shortcode_type/migration.sql'
);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await c.connect();
  await c.query(sql);
  console.log('APPLIED.');

  const cols = await c.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'kx_mpesa_configs'
      AND column_name = 'shortcodeType'
  `);
  console.log('Column:', cols.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}