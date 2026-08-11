// scripts/clear-sales.js
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🗑️ Clearing sales data...');
  await prisma.kxTillSaleItem.deleteMany();
  await prisma.kxTillSale.deleteMany();
  console.log('✅ Sales cleared');
}

main().catch(console.error);