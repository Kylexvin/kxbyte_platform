import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990'; // KxNet

const branches = await prisma.branch.findMany({
  where: { organizationId: ORG_ID, isActive: true },
  select: { id: true, name: true, code: true },
});
console.log('Branches:');
console.table(branches);

const products = await prisma.kxTillProduct.findMany({
  where: { organizationId: ORG_ID, isActive: true },
  select: { id: true, name: true, sku: true },
  take: 20,
});
console.log('Products:');
console.table(products);

if (branches[0] && products[0]) {
  const branchProduct = await prisma.kxTillBranchProduct.findUnique({
    where: {
      productId_branchId: {
        productId: products[0].id,
        branchId: branches[0].id,
      },
    },
    select: { id: true, stock: true, isAvailable: true },
  });
  console.log(`BranchProduct for [${products[0].name} @ ${branches[0].name}]:`);
  console.log(branchProduct);
}

await prisma.$disconnect();