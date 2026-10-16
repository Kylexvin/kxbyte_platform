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
  'src/database/postgres/prisma/migrations/20261016050000_add_mpesa_config/migration.sql'
);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await c.connect();
  await c.query(sql);
  console.log('APPLIED.');

  const tables = await c.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('kx_mpesa_configs', 'kx_mpesa_transactions')
    ORDER BY table_name
  `);
  console.log('Tables:');
  console.table(tables.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}