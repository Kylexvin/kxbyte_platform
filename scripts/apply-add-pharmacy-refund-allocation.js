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
  'src/database/postgres/prisma/migrations/20261008030000_add_pharmacy_refund_allocation/migration.sql'
);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  await c.connect();
  await c.query(sql);
  console.log('APPLIED.');

  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'kxtill_pharmacy_sale_batch_allocations'
      AND column_name = 'refundedQuantity'
  `);
  console.log('refundedQuantity exists:', cols.rows.length === 1);

  const table = await c.query(`
    SELECT to_regclass('public.kxtill_pharmacy_refund_allocations') AS t
  `);
  console.log('refund_allocations table:', table.rows[0].t);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}