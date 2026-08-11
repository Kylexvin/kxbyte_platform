// scripts/fix-column-names.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🔧 Fixing column names...');

  // Rename columns to camelCase
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN productid TO "productId"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN branchid TO "branchId"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN displayname TO "displayName"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN isavailable TO "isAvailable"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN minstock TO "minStock"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN createdat TO "createdAt"`;
  await prisma.$executeRaw`ALTER TABLE kxtill_branch_products RENAME COLUMN updatedat TO "updatedAt"`;

  console.log('✅ Column names fixed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());