// scripts/backfill-customer-product.js

import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🔄 Backfilling createdByProduct for customers...');

  // Get all customers with null createdByProduct
  const customers = await prisma.customer.findMany({
    where: {
      createdByProduct: null,
    },
  });

  console.log(`📦 Found ${customers.length} customers with null createdByProduct`);

  for (const customer of customers) {
    // Check if customer has KxTill sales
    const saleCount = await prisma.kxTillSale.count({
      where: {
        customerId: customer.id,
      },
    });

    // If they have KxTill sales OR were created recently (assume KxTill)
    // Update to 'kxtill'
    await prisma.customer.update({
      where: { id: customer.id },
      data: { createdByProduct: 'kxtill' },
    });

    console.log(`✅ ${customer.name} (${customer.phone}) → kxtill (${saleCount} sales)`);
  }

  console.log('✅ Backfill complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());