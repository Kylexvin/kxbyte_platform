// scripts/migrate-to-branch-inventory.js

import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🔄 Migrating products to branch inventory...');

  // Get all products
  const products = await prisma.kxTillProduct.findMany({
    where: { organizationId: 'c3d652ba-5a0e-4e94-a4d0-e4337b1ce8c4' },
  });

  console.log(`📦 Found ${products.length} products`);

  // Get all branches for Kamau's org
  const branches = await prisma.branch.findMany({
    where: { organizationId: 'c3d652ba-5a0e-4e94-a4d0-e4337b1ce8c4' },
  });

  console.log(`🏢 Found ${branches.length} branches`);

  for (const product of products) {
    // Check if product has stock, default to 0 if not
    const productStock = product.stock || 0;
    const productMinStock = product.minStock || 0;

    for (const branch of branches) {
      // Create branch product
      const branchProduct = await prisma.kxTillBranchProduct.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          displayName: product.name,
          stock: productStock / branches.length, // Distribute stock evenly
          minStock: productMinStock / branches.length,
          isAvailable: true,
        },
      });
      console.log(`✅ ${product.name} → ${branch.name}: ${branchProduct.stock} units`);
    }
  }

  console.log('✅ Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());