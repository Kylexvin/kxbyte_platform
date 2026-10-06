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
  'src/database/postgres/prisma/migrations/20261006050000_rework_pharmacy_config_instance/migration.sql'
);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await c.connect();
  await c.query(sql);
  console.log('APPLIED.');

  const cols = await c.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_pharmacy_config'
    ORDER BY ordinal_position
  `);
  console.log('kxtill_pharmacy_config columns:');
  console.table(cols.rows);

  const tables = await c.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('product_instances')
  `);
  console.log('New tables:');
  console.table(tables.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}