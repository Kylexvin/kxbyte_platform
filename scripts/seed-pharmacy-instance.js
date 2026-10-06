import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990';  // KxNet
const PRODUCT_KEY = 'kxtill';

const VERTICALS = [
  { vertical: 'retail',   name: 'KxNet Retail' },
  { vertical: 'pharmacy', name: 'KxNet Main Pharmacy' },
];

async function main() {
  const product = await prisma.product.findUnique({
    where: { key: PRODUCT_KEY },
  });
  if (!product) throw new Error(`Product ${PRODUCT_KEY} not found`);
  console.log('Product:', product.id, product.key);

  const orgProduct = await prisma.organizationProduct.findUnique({
    where: {
      organizationId_productId: {
        organizationId: ORG_ID,
        productId: product.id,
      },
    },
  });
  if (!orgProduct) throw new Error('KxNet has not activated kxtill');
  if (!orgProduct.isActive) throw new Error('kxtill activation is inactive');
  console.log('OrganizationProduct:', orgProduct.id);

  for (const v of VERTICALS) {
    console.log(`\n── ${v.vertical.toUpperCase()} ──`);

    const instance = await prisma.productInstance.upsert({
      where: {
        organizationProductId_vertical_name: {
          organizationProductId: orgProduct.id,
          vertical: v.vertical,
          name: v.name,
        },
      },
      update: { isActive: true },
      create: {
        organizationProductId: orgProduct.id,
        vertical: v.vertical,
        name: v.name,
        isActive: true,
      },
    });
    console.log('  ProductInstance:', instance.id, '→', instance.name);

    if (v.vertical === 'pharmacy') {
      const config = await prisma.kxTillPharmacyConfig.upsert({
        where: { productInstanceId: instance.id },
        update: {},
        create: {
          productInstanceId: instance.id,
          isEnabled: true,
          expiryWarningDays: 90,
          blockExpiredSales: true,
          requireBatchOnSale: true,
        },
      });
      console.log('  PharmacyConfig:', config.id);
      console.log('    isEnabled:', config.isEnabled);
      console.log('    expiryWarningDays:', config.expiryWarningDays);
      console.log('    blockExpiredSales:', config.blockExpiredSales);
      console.log('    requireBatchOnSale:', config.requireBatchOnSale);
    } else {
      console.log('  (no vertical config — retail is Core-only)');
    }
  }

  // Verify
  const all = await prisma.productInstance.findMany({
    where: { organizationProductId: orgProduct.id },
    include: { pharmacyConfig: true },
    orderBy: { vertical: 'asc' },
  });
  console.log('\n✅ KxNet instances:');
  console.log(JSON.stringify(all.map((i) => ({
    id: i.id,
    vertical: i.vertical,
    name: i.name,
    isActive: i.isActive,
    hasPharmacyConfig: !!i.pharmacyConfig,
  })), null, 2));
}

main()
  .catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });