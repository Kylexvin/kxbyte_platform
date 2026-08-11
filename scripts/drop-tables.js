// scripts/drop-tables.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  await prisma.$executeRaw`DROP TABLE IF EXISTS kxtill_branch_product_unit_prices CASCADE;`;
  await prisma.$executeRaw`DROP TABLE IF EXISTS kxtill_branch_products CASCADE;`;
  console.log('✅ Tables dropped');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());