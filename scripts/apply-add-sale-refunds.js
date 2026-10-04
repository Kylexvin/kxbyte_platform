import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  // 1. kxtill_sale_refunds
  await c.query(`
    CREATE TABLE IF NOT EXISTS "kxtill_sale_refunds" (
      "id"             TEXT         NOT NULL,
      "reference"      TEXT         NOT NULL,
      "organizationId" TEXT         NOT NULL,
      "saleId"         TEXT         NOT NULL,
      "branchId"       TEXT         NOT NULL,
      "shiftId"        TEXT,
      "userId"         TEXT         NOT NULL,
      "totalAmount"    DECIMAL(65,30) NOT NULL,
      "cashAmount"     DECIMAL(65,30) NOT NULL DEFAULT 0,
      "creditAmount"   DECIMAL(65,30) NOT NULL DEFAULT 0,
      "otherAmount"    DECIMAL(65,30) NOT NULL DEFAULT 0,
      "reason"         TEXT,
      "note"           TEXT,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "kxtill_sale_refunds_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_sale_refunds_reference_key" ON "kxtill_sale_refunds"("reference");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_organizationId_idx" ON "kxtill_sale_refunds"("organizationId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_saleId_idx" ON "kxtill_sale_refunds"("saleId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_branchId_idx" ON "kxtill_sale_refunds"("branchId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_shiftId_idx" ON "kxtill_sale_refunds"("shiftId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refunds_createdAt_idx" ON "kxtill_sale_refunds"("createdAt");`);

  // 2. kxtill_sale_refund_items
  await c.query(`
    CREATE TABLE IF NOT EXISTS "kxtill_sale_refund_items" (
      "id"         TEXT         NOT NULL,
      "refundId"   TEXT         NOT NULL,
      "saleItemId" TEXT         NOT NULL,
      "quantity"   DECIMAL(65,30) NOT NULL,
      "unitPrice"  DECIMAL(65,30) NOT NULL,
      "total"      DECIMAL(65,30) NOT NULL,
      "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "kxtill_sale_refund_items_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refund_items_refundId_idx" ON "kxtill_sale_refund_items"("refundId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sale_refund_items_saleItemId_idx" ON "kxtill_sale_refund_items"("saleItemId");`);

  // 3. kxtill_sales.refundedAmount
  await c.query(`ALTER TABLE "kxtill_sales" ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;`);

  // 4. FKs
  const fks = [
    ['kxtill_sale_refunds_organizationId_fkey',     'kxtill_sale_refunds',      'organizationId', 'organizations',       'CASCADE'],
    ['kxtill_sale_refunds_saleId_fkey',             'kxtill_sale_refunds',      'saleId',         'kxtill_sales',        'CASCADE'],
    ['kxtill_sale_refunds_branchId_fkey',           'kxtill_sale_refunds',      'branchId',       'branches',            'RESTRICT'],
    ['kxtill_sale_refunds_shiftId_fkey',            'kxtill_sale_refunds',      'shiftId',        'kxtill_shifts',       'SET NULL'],
    ['kxtill_sale_refunds_userId_fkey',             'kxtill_sale_refunds',      'userId',         'users',               'RESTRICT'],
    ['kxtill_sale_refund_items_refundId_fkey',      'kxtill_sale_refund_items', 'refundId',       'kxtill_sale_refunds', 'CASCADE'],
    ['kxtill_sale_refund_items_saleItemId_fkey',    'kxtill_sale_refund_items', 'saleItemId',     'kxtill_sale_items',   'RESTRICT'],
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
  console.log('\n=== kxtill_sale_refunds columns ===');
  const s1 = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'kxtill_sale_refunds' ORDER BY ordinal_position`);
  console.table(s1.rows);

  console.log('\n=== kxtill_sale_refund_items columns ===');
  const s2 = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'kxtill_sale_refund_items' ORDER BY ordinal_position`);
  console.table(s2.rows);

  console.log('\n=== kxtill_sales.refundedAmount ===');
  const s3 = await c.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'kxtill_sales' AND column_name = 'refundedAmount'`);
  console.table(s3.rows);

  console.log('\n=== FKs ===');
  const s4 = await c.query(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS references_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (tc.table_name IN ('kxtill_sale_refunds','kxtill_sale_refund_items'))
    ORDER BY tc.table_name, tc.constraint_name
  `);
  console.table(s4.rows);

  console.log('\nAPPLIED.');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}