// scripts/reset-trial-14.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import { addDays } from 'date-fns';

const subs = await prisma.subscription.findMany({
  where: { productKey: 'kxtill', status: 'TRIAL' },
});

console.log(`found ${subs.length} TRIAL subscriptions`);

for (const s of subs) {
  if (!s.trialStart) {
    console.log(`SKIP ${s.organizationId} — no trialStart`);
    continue;
  }
  const trialEnd = addDays(s.trialStart, 14);
  await prisma.subscription.update({
    where: { id: s.id },
    data: { trialEnd },
  });
  console.log(`OK ${s.organizationId} → ${trialEnd.toISOString()}`);
}

console.log('done');
await prisma.$disconnect();