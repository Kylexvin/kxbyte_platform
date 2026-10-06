import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  await c.query(
    `INSERT INTO _prisma_migrations
       (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES (
       gen_random_uuid()::text,
       'manual',
       '20261006030000_add_pharmacy_extension',
       NOW(),
       NOW(),
       1
     )`
  );
  console.log('marked');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}