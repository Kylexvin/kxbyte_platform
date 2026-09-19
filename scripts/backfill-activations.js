// scripts/backfill-activations.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import productService from '../src/modules/platform/products/services/product.service.js';

const PRODUCT_KEY = 'kxtill';

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { isInternal: false, isArchived: false, isActive: true },
    select: { id: true, name: true, slug: true, ownerId: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[backfill] found ${orgs.length} eligible orgs`);

  for (const org of orgs) {
    try {
      const result = await productService.activateProduct(org.id, org.ownerId, PRODUCT_KEY);
      if (result.isActive) {
        console.log(`[backfill] OK: ${org.slug} (activatedAt=${result.activatedAt})`);
      }
    } catch (e) {
      if (e.message === 'Subscription already exists for this product') {
        console.log(`[backfill] SKIP: ${org.slug} (already has subscription)`);
      } else if (e.message.includes('already active')) {
        console.log(`[backfill] SKIP: ${org.slug} (already active)`);
      } else {
        console.log(`[backfill] FAIL: ${org.slug} — ${e.message}`);
      }
    }
  }

  console.log('[backfill] done');
}

main()
  .catch((e) => { console.error('[backfill] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());