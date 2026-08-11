// scripts/fix-tables.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🔧 Fixing tables...');

  // 1. Create branch products table
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS kxtill_branch_products (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "productId" TEXT NOT NULL REFERENCES kxtill_products(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      "displayName" TEXT,
      description TEXT,
      "isAvailable" BOOLEAN DEFAULT true,
      stock DECIMAL DEFAULT 0,
      "minStock" DECIMAL DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  console.log('✅ kxtill_branch_products created');

  // 2. Create unit prices table
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS kxtill_branch_product_unit_prices (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "branchProductId" TEXT NOT NULL REFERENCES kxtill_branch_products(id) ON DELETE CASCADE,
      "unitId" TEXT NOT NULL REFERENCES kxtill_product_units(id) ON DELETE CASCADE,
      price DECIMAL NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  console.log('✅ kxtill_branch_product_unit_prices created');

  // 3. Add branchProductId to sale items
  await prisma.$executeRaw`
    ALTER TABLE kxtill_sale_items 
    ADD COLUMN IF NOT EXISTS "branchProductId" TEXT 
    REFERENCES kxtill_branch_products(id) ON DELETE RESTRICT
  `;
  console.log('✅ branchProductId added to kxtill_sale_items');

  // 4. Add branchId to sales if it doesn't exist
  await prisma.$executeRaw`
    ALTER TABLE kxtill_sales 
    ADD COLUMN IF NOT EXISTS "branchId" TEXT
  `;
  console.log('✅ branchId added to kxtill_sales');

  // 5. Set default branch for existing sales
  await prisma.$executeRaw`
    UPDATE kxtill_sales 
    SET "branchId" = (
      SELECT id FROM branches 
      WHERE "organizationId" = kxtill_sales."organizationId"
      LIMIT 1
    )
    WHERE "branchId" IS NULL
  `;
  console.log('✅ Default branch set for existing sales');

  // 6. Make branchId required
  await prisma.$executeRaw`
    ALTER TABLE kxtill_sales 
    ALTER COLUMN "branchId" SET NOT NULL
  `;
  console.log('✅ branchId set to NOT NULL');

  // 7. Add foreign key constraint
  await prisma.$executeRaw`
    ALTER TABLE kxtill_sales 
    ADD CONSTRAINT kxtill_sales_branchId_fkey 
    FOREIGN KEY ("branchId") REFERENCES branches(id) ON DELETE RESTRICT
  `;
  console.log('✅ Foreign key added');

  console.log('✅ All fixes applied!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());