import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const PRODUCT_KEY = 'kxtill';
const DEFAULT_VERTICAL = 'retail';

async function main() {
  const product = await prisma.product.findUnique({
    where: { key: PRODUCT_KEY },
  });
  if (!product) throw new Error(`Product ${PRODUCT_KEY} not found`);
  console.log(`Product: ${product.id} (${product.key})\n`);

  const rows = await prisma.organizationProduct.findMany({
    where: {
      productId: product.id,
      isActive: true,
    },
    include: {
      organization: { select: { id: true, name: true } },
      instances: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${rows.length} active OrganizationProduct rows.\n`);

  let created = 0;
  let skipped = 0;

  for (const op of rows) {
    const orgName = op.organization?.name ?? 'Unnamed Org';

    if (op.instances.length > 0) {
      console.log(
        `[skip] ${orgName} (${op.id}) — already has ${op.instances.length} instance(s)`
      );
      skipped++;
      continue;
    }

    const name = `${orgName} Retail`;
    const instance = await prisma.productInstance.create({
      data: {
        organizationProductId: op.id,
        vertical: DEFAULT_VERTICAL,
        name,
        isActive: true,
      },
    });

    console.log(
      `[created] ${orgName} (${op.id}) → instance ${instance.id} (${instance.vertical}: ${instance.name})`
    );
    created++;
  }

  console.log(`\n── Summary ──`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);

  // Verify: show final state of every active kxtill activation
  console.log(`\n── Final state ──`);
  const final = await prisma.organizationProduct.findMany({
    where: { productId: product.id, isActive: true },
    include: {
      organization: { select: { name: true } },
      instances: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const op of final) {
    const verticals = op.instances.map((i) => i.vertical).join(', ') || '(none)';
    console.log(`  ${op.organization?.name ?? 'Unknown'} → ${verticals}`);
  }
}

main()
  .catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });