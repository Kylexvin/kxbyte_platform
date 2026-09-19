// add-column.js
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;`);
await client.query(`CREATE INDEX IF NOT EXISTS "organizations_isInternal_idx" ON "organizations"("isInternal");`);
console.log('Done');
await client.end();