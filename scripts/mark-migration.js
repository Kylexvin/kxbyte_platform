// scripts/mark-migration.js
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
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES (gen_random_uuid()::text, 'manual', '20260922120000_add_trial_burn', NOW(), NOW(), 1)`
  );
  console.log('marked');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}