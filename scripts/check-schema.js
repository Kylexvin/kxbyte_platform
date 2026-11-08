import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

await c.connect();
const r = await c.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_name IN ('leads', 'lead_assignees')
   ORDER BY table_name, ordinal_position`
);
console.table(r.rows);
await c.end();