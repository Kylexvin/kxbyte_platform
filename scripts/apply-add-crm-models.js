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
    'src/database/postgres/prisma/migrations/20261107030000_add_crm_models/migration.sql'
  ),
  'utf8'
);

try {
  await c.connect();
  await c.query(sql);

  for (const table of ['pipeline_stages', 'leads', 'lead_activities']) {
    const check = await c.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\nAPPLIED. ${table} columns:`);
    console.table(check.rows);
  }

  const fks = await c.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('pipeline_stages', 'leads', 'lead_activities')
    ORDER BY tc.table_name, kcu.column_name
  `);
  console.log('\nForeign keys:');
  console.table(fks.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}