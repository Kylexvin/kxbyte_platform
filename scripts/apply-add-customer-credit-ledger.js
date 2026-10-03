import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  // 1. customer_credit_ledger
  await c.query(`
    CREATE TABLE IF NOT EXISTS "customer_credit_ledger" (
      "id"             TEXT         NOT NULL,
      "organizationId" TEXT         NOT NULL,
      "customerId"     TEXT         NOT NULL,
      "branchId"       TEXT,
      "type"           TEXT         NOT NULL,
      "amount"         DECIMAL(65,30) NOT NULL,
      "saleId"         TEXT,
      "shiftId"        TEXT,
      "note"           TEXT,
      "createdById"    TEXT         NOT NULL,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "customer_credit_ledger_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_organizationId_idx" ON "customer_credit_ledger"("organizationId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_customerId_idx" ON "customer_credit_ledger"("customerId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_customerId_createdAt_idx" ON "customer_credit_ledger"("customerId", "createdAt");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_type_idx" ON "customer_credit_ledger"("type");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_saleId_idx" ON "customer_credit_ledger"("saleId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "customer_credit_ledger_shiftId_idx" ON "customer_credit_ledger"("shiftId");`);

  // 2. customers
  await c.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(65,30);`);

  // 3. kxtill_branch_settings
  await c.query(`ALTER TABLE "kxtill_branch_settings" ADD COLUMN IF NOT EXISTS "creditEnabled" BOOLEAN NOT NULL DEFAULT false;`);

  // 4. kxtill_sale_payments
  await c.query(`ALTER TABLE "kxtill_sale_payments" ADD COLUMN IF NOT EXISTS "creditLedgerId" TEXT;`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_payments_creditLedgerId_idx" ON "kxtill_sale_payments"("creditLedgerId");`);

  // 5. FKs
  const fks = [
    ['customer_credit_ledger_organizationId_fkey', 'customer_credit_ledger', 'organizationId', 'organizations', 'CASCADE'],
    ['customer_credit_ledger_customerId_fkey',     'customer_credit_ledger', 'customerId',     'customers',      'RESTRICT'],
    ['customer_credit_ledger_branchId_fkey',       'customer_credit_ledger', 'branchId',       'branches',       'SET NULL'],
    ['customer_credit_ledger_saleId_fkey',         'customer_credit_ledger', 'saleId',         'kxtill_sales',   'SET NULL'],
    ['customer_credit_ledger_shiftId_fkey',        'customer_credit_ledger', 'shiftId',        'kxtill_shifts',  'SET NULL'],
    ['customer_credit_ledger_createdById_fkey',    'customer_credit_ledger', 'createdById',    'users',          'RESTRICT'],
    ['kxtill_sale_payments_creditLedgerId_fkey',   'kxtill_sale_payments',   'creditLedgerId', 'customer_credit_ledger', 'SET NULL'],
  ];

  for (const [name, table, col, refTable, onDelete] of fks) {
    await c.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}"
            ADD CONSTRAINT "${name}"
            FOREIGN KEY ("${col}") REFERENCES "${refTable}"("id")
            ON DELETE ${onDelete} ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  // Verify
  console.log('\n=== customer_credit_ledger columns ===');
  const s1 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customer_credit_ledger'
    ORDER BY ordinal_position
  `);
  console.table(s1.rows);

  console.log('\n=== customers.creditLimit ===');
  const s2 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'creditLimit'
  `);
  console.table(s2.rows);

  console.log('\n=== kxtill_branch_settings.creditEnabled ===');
  const s3 = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'kxtill_branch_settings' AND column_name = 'creditEnabled'
  `);
  console.table(s3.rows);

  console.log('\n=== kxtill_sale_payments.creditLedgerId ===');
  const s4 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_sale_payments' AND column_name = 'creditLedgerId'
  `);
  console.table(s4.rows);

  console.log('\n=== FKs ===');
  const s5 = await c.query(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS references_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (tc.table_name = 'customer_credit_ledger'
        OR (tc.table_name = 'kxtill_sale_payments' AND kcu.column_name = 'creditLedgerId'))
    ORDER BY tc.table_name, tc.constraint_name
  `);
  console.table(s5.rows);

  console.log('\nAPPLIED.');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}