// scripts/backfill-trial-burns.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED'] },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          isInternal: true,
        },
      },
    },
  });

  console.log(`[backfill] ${subs.length} subscriptions to consider`);

  let created = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (sub.organization.isInternal) {
      skipped++;
      continue;
    }

    try {
      await prisma.trialBurn.create({
        data: {
          ownerUserId: sub.organization.ownerId,
          productKey: sub.productKey,
          organizationId: sub.organization.id,
        },
      });
      created++;
      console.log(`  + ${sub.organization.slug} · ${sub.productKey}`);
    } catch (err) {
      if (err.code === 'P2002') {
        skipped++;
      } else {
        console.error(`  ! ${sub.organization.slug} · ${sub.productKey}:`, err.message);
      }
    }
  }

  console.log(`[backfill] created: ${created}, skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());