import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = '57a669af-58ba-4b2f-9615-36da4e5d72e0';

const product = await prisma.product.findUnique({ where: { key: 'kxtill' } });
console.log('Product:', product?.id);

const op = await prisma.organizationProduct.findUnique({
  where: {
    organizationId_productId: {
      organizationId: ORG_ID,
      productId: product.id,
    },
  },
  include: { instances: true },
});

console.log('OrganizationProduct:', op?.id);
console.log('Instances:', JSON.stringify(op?.instances, null, 2));

await prisma.$disconnect();