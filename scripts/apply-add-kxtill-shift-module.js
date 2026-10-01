import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  // ----------------------------------------------------------
  // 1. kxtill_branch_settings
  // ----------------------------------------------------------
  await c.query(`
    CREATE TABLE IF NOT EXISTS "kxtill_branch_settings" (
      "id"                TEXT         NOT NULL,
      "branchId"          TEXT         NOT NULL,
      "shiftsEnabled"     BOOLEAN      NOT NULL DEFAULT false,
      "varianceThreshold" DECIMAL(65,30) NOT NULL DEFAULT 50,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL,
      CONSTRAINT "kxtill_branch_settings_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_branch_settings_branchId_key"
      ON "kxtill_branch_settings"("branchId");
  `);

  // ----------------------------------------------------------
  // 2. kxtill_shifts
  // ----------------------------------------------------------
  await c.query(`
    CREATE TABLE IF NOT EXISTS "kxtill_shifts" (
      "id"                    TEXT         NOT NULL,
      "organizationId"        TEXT         NOT NULL,
      "branchId"              TEXT         NOT NULL,
      "userId"                TEXT         NOT NULL,
      "tillId"                TEXT,
      "status"                TEXT         NOT NULL DEFAULT 'OPEN',
      "closureType"           TEXT,
      "openingFloat"          DECIMAL(65,30) NOT NULL,
      "declaredCash"          DECIMAL(65,30),
      "expectedCash"          DECIMAL(65,30),
      "variance"              DECIMAL(65,30),
      "openedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "closedAt"              TIMESTAMP(3),
      "openedById"            TEXT         NOT NULL,
      "closedById"            TEXT,
      "handoverRequestedById" TEXT,
      "handoverResolvedById"  TEXT,
      "handoverResolvedAt"    TIMESTAMP(3),
      "handoverNote"          TEXT,
      "varianceReviewedById"  TEXT,
      "varianceReviewedAt"    TIMESTAMP(3),
      "varianceNote"          TEXT,
      "deletedAt"             TIMESTAMP(3),
      "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"             TIMESTAMP(3) NOT NULL,
      CONSTRAINT "kxtill_shifts_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_shifts_organizationId_idx" ON "kxtill_shifts"("organizationId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_shifts_userId_idx"         ON "kxtill_shifts"("userId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_shifts_status_idx"         ON "kxtill_shifts"("status");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_shifts_branchId_status_idx" ON "kxtill_shifts"("branchId", "status");`);

  // ----------------------------------------------------------
  // 3. kxtill_sales — add columns + indexes
  // ----------------------------------------------------------
  await c.query(`ALTER TABLE "kxtill_sales" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;`);
  await c.query(`ALTER TABLE "kxtill_sales" ADD COLUMN IF NOT EXISTS "refundShiftId" TEXT;`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sales_shiftId_idx"        ON "kxtill_sales"("shiftId");`);
  await c.query(`CREATE INDEX IF NOT EXISTS "kxtill_sales_refundShiftId_idx"  ON "kxtill_sales"("refundShiftId");`);

  // ----------------------------------------------------------
  // 4. FKs — kxtill_branch_settings
  // ----------------------------------------------------------
  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_branch_settings_branchId_fkey') THEN
        ALTER TABLE "kxtill_branch_settings"
          ADD CONSTRAINT "kxtill_branch_settings_branchId_fkey"
          FOREIGN KEY ("branchId") REFERENCES "branches"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // ----------------------------------------------------------
  // 5. FKs — kxtill_shifts
  // ----------------------------------------------------------
  const shiftFks = [
    ['kxtill_shifts_organizationId_fkey',        'organizationId',        'organizations', 'CASCADE'],
    ['kxtill_shifts_branchId_fkey',              'branchId',              'branches',      'CASCADE'],
    ['kxtill_shifts_userId_fkey',                'userId',                'users',         'RESTRICT'],
    ['kxtill_shifts_openedById_fkey',            'openedById',            'users',         'RESTRICT'],
    ['kxtill_shifts_closedById_fkey',            'closedById',            'users',         'SET NULL'],
    ['kxtill_shifts_handoverRequestedById_fkey', 'handoverRequestedById', 'users',         'SET NULL'],
    ['kxtill_shifts_handoverResolvedById_fkey',  'handoverResolvedById',  'users',         'SET NULL'],
    ['kxtill_shifts_varianceReviewedById_fkey',  'varianceReviewedById',  'users',         'SET NULL'],
  ];

  for (const [name, col, refTable, onDelete] of shiftFks) {
    await c.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "kxtill_shifts"
            ADD CONSTRAINT "${name}"
            FOREIGN KEY ("${col}") REFERENCES "${refTable}"("id")
            ON DELETE ${onDelete} ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  // ----------------------------------------------------------
  // 6. FKs — kxtill_sales new columns
  // ----------------------------------------------------------
  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sales_shiftId_fkey') THEN
        ALTER TABLE "kxtill_sales"
          ADD CONSTRAINT "kxtill_sales_shiftId_fkey"
          FOREIGN KEY ("shiftId") REFERENCES "kxtill_shifts"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await c.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kxtill_sales_refundShiftId_fkey') THEN
        ALTER TABLE "kxtill_sales"
          ADD CONSTRAINT "kxtill_sales_refundShiftId_fkey"
          FOREIGN KEY ("refundShiftId") REFERENCES "kxtill_shifts"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // ----------------------------------------------------------
  // VERIFY
  // ----------------------------------------------------------
  console.log('\n=== kxtill_branch_settings columns ===');
  const s1 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_branch_settings'
    ORDER BY ordinal_position
  `);
  console.table(s1.rows);

  console.log('\n=== kxtill_shifts columns ===');
  const s2 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_shifts'
    ORDER BY ordinal_position
  `);
  console.table(s2.rows);

  console.log('\n=== kxtill_sales new columns ===');
  const s3 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_sales'
      AND column_name IN ('shiftId','refundShiftId')
    ORDER BY ordinal_position
  `);
  console.table(s3.rows);

  console.log('\n=== Foreign keys on new tables/columns ===');
  const s4 = await c.query(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name  AS references_table,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (
        tc.table_name IN ('kxtill_shifts','kxtill_branch_settings')
        OR (tc.table_name = 'kxtill_sales' AND kcu.column_name IN ('shiftId','refundShiftId'))
      )
    ORDER BY tc.table_name, tc.constraint_name
  `);
  console.table(s4.rows);

  console.log('\nAPPLIED.');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}