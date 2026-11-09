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
    CREATE TABLE IF NOT EXISTS "kxtill_favorite_products" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "branchId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "kxtill_favorite_products_pkey" PRIMARY KEY ("id")
    );
  `);

  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "kxtill_favorite_products_userId_branchId_productId_key"
      ON "kxtill_favorite_products"("userId", "branchId", "productId");
  `);

  await c.query(`
    CREATE INDEX IF NOT EXISTS "kxtill_favorite_products_organizationId_branchId_idx"
      ON "kxtill_favorite_products"("organizationId", "branchId");
  `);

  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'kxtill_favorite_products'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(check.rows);

  const idx = await c.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'kxtill_favorite_products'
    ORDER BY indexname
  `);
  console.log('APPLIED. Indexes:');
  console.table(idx.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}