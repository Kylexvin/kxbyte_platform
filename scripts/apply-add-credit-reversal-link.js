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
    `ALTER TABLE "customer_credit_ledger" ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;`
  );

  await c.query(
    `CREATE INDEX IF NOT EXISTS "customer_credit_ledger_reversalOfId_idx" ON "customer_credit_ledger"("reversalOfId");`
  );

  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_credit_ledger_reversalOfId_fkey') THEN
        ALTER TABLE "customer_credit_ledger"
          ADD CONSTRAINT "customer_credit_ledger_reversalOfId_fkey"
          FOREIGN KEY ("reversalOfId") REFERENCES "customer_credit_ledger"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log('\n=== customer_credit_ledger.reversalOfId ===');
  const s1 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customer_credit_ledger' AND column_name = 'reversalOfId'
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
      AND tc.constraint_name = 'customer_credit_ledger_reversalOfId_fkey'
  `);
  console.table(s2.rows);

  console.log('\nAPPLIED.');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}