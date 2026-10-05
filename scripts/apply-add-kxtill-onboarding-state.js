import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS "kxtill_onboarding_state" (
      "id"             TEXT         NOT NULL,
      "organizationId" TEXT         NOT NULL,
      "isDismissed"    BOOLEAN      NOT NULL DEFAULT false,
      "completedAt"    TIMESTAMP(3),
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      TIMESTAMP(3) NOT NULL,
      CONSTRAINT "kxtill_onboarding_state_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_onboarding_state_organizationId_key"
      ON "kxtill_onboarding_state"("organizationId");
  `);

  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_onboarding_state_organizationId_fkey') THEN
        ALTER TABLE "kxtill_onboarding_state"
          ADD CONSTRAINT "kxtill_onboarding_state_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log('\n=== kxtill_onboarding_state columns ===');
  const s1 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_onboarding_state'
    ORDER BY ordinal_position
  `);
  console.table(s1.rows);

  console.log('\n=== FK ===');
  const s2 = await c.query(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS references_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'kxtill_onboarding_state_organizationId_fkey'
  `);
  console.table(s2.rows);

  console.log('\nAPPLIED.');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}