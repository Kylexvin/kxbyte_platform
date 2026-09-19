import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import subscriptionService from '../src/modules/platform/subscriptions/services/subscription.service.js';
import { addDays } from 'date-fns';

const orgId = '831f2bed-a1e4-4b89-9527-a75c0c715ea7';

for (const days of [7, 3, 1]) {
  const target = addDays(new Date(), days);
  await prisma.subscription.updateMany({
    where: { organizationId: orgId, productKey: 'kxtill' },
    data: { status: 'TRIAL', trialEnd: target, graceStart: null, graceEnd: null },
  });
  console.log(`\n=== trialEnd set to ${days} days out ===`);
  const first = await subscriptionService.runSweep();
  const second = await subscriptionService.runSweep();
  console.log(`run 1 transitions: ${first.length}, run 2 transitions: ${second.length}`);
}

await prisma.$disconnect();