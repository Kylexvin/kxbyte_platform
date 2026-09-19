// scripts/standardize-plans.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

async function main() {
  const standard = await prisma.plan.findUnique({
    where: { productKey_key: { productKey: 'kxtill', key: 'standard' } },
  });

  if (!standard) {
    console.error('[standardize] standard plan not found — boot server once to register');
    process.exit(1);
  }

  const result = await prisma.subscription.updateMany({
    where: { productKey: 'kxtill' },
    data: { planId: standard.id },
  });
  console.log(`[standardize] updated ${result.count} subscriptions to plan '${standard.key}'`);

  const deactivated = await prisma.plan.updateMany({
    where: { productKey: 'kxtill', key: { not: 'standard' } },
    data: { isActive: false },
  });
  console.log(`[standardize] deactivated ${deactivated.count} old plans`);
}

main()
  .catch((e) => { console.error('[standardize] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());