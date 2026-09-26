// scripts/purge-stale-sessions.js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  const res = await c.query(`
    DELETE FROM sessions
    WHERE "ipAddress" IS NULL
      AND "createdAt" < NOW() - INTERVAL '1 day'
  `);
  console.log(`Deleted ${res.rowCount} stale sessions`);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}