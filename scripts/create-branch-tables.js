// scripts/create-branch-tables.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('Creating tables...');

  // Check if table exists
  const result = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'kxtill_branch_products'
    );
  `;

  const exists = result[0].exists;

  if (!exists) {
    await prisma.$executeRaw`
      CREATE TABLE kxtill_branch_products (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        productId TEXT NOT NULL REFERENCES kxtill_products(id) ON DELETE CASCADE,
        branchId TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        displayName TEXT,
        description TEXT,
        isAvailable BOOLEAN DEFAULT true,
        stock DECIMAL DEFAULT 0,
        minStock DECIMAL DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ kxtill_branch_products created');
  } else {
    console.log('✅ kxtill_branch_products already exists');
  }

  // Check unit prices table
  const result2 = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'kxtill_branch_product_unit_prices'
    );
  `;

  const exists2 = result2[0].exists;

  if (!exists2) {
    await prisma.$executeRaw`
      CREATE TABLE kxtill_branch_product_unit_prices (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        branchProductId TEXT NOT NULL REFERENCES kxtill_branch_products(id) ON DELETE CASCADE,
        unitId TEXT NOT NULL REFERENCES kxtill_product_units(id) ON DELETE CASCADE,
        price DECIMAL NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ kxtill_branch_product_unit_prices created');
  } else {
    console.log('✅ kxtill_branch_product_unit_prices already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());