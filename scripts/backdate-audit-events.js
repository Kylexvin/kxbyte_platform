// scripts/backdate-audit-events.js
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
    UPDATE audit_events
    SET "createdAt" = NOW() - INTERVAL '90 days'
    WHERE id IN (
      SELECT id FROM audit_events
      WHERE "organizationId" = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990'
      ORDER BY "createdAt" DESC
      LIMIT 5
    )
  `);
  console.log(`Backdated ${res.rowCount} events`);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}