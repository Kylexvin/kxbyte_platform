// scripts/backfill-subscriptions.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import subscriptionService from '../src/modules/platform/subscriptions/services/subscription.service.js';

async function main() {
  const orgProducts = await prisma.organizationProduct.findMany({
    where: {
      isActive: true,
      product: { key: { not: 'admin' } },
    },
    include: { product: true },
  });

  console.log(`[backfill] found ${orgProducts.length} active org-products`);

  for (const op of orgProducts) {
    const existing = await prisma.subscription.findUnique({
      where: {
        organizationId_productKey: {
          organizationId: op.organizationId,
          productKey: op.product.key,
        },
      },
    });

    if (existing) {
      console.log(`[backfill] exists: ${op.product.key} / ${op.organizationId}`);
      continue;
    }

    try {
      const plan = await prisma.plan.findFirst({
        where: { productKey: op.product.key, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!plan) {
        console.log(`[backfill] NO PLAN for ${op.product.key} — skipping org ${op.organizationId}`);
        continue;
      }

      await subscriptionService.createSubscription(
        op.organizationId,
        op.product.key,
        plan.key
      );
      console.log(`[backfill] created: ${op.product.key} / ${op.organizationId} (plan=${plan.key}, trialDays=${plan.trialDays})`);
    } catch (e) {
      console.log(`[backfill] FAILED: ${op.product.key} / ${op.organizationId} — ${e.message}`);
    }
  }

  console.log('[backfill] done');
}

main()
  .catch((e) => { console.error('[backfill] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());