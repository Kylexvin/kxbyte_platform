// scripts/test-grace.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import { addDays } from 'date-fns';

async function main() {
  const orgId = '831f2bed-a1e4-4b89-9527-a75c0c715ea7';
  const sub = await prisma.subscription.findUnique({
    where: { organizationId_productKey: { organizationId: orgId, productKey: 'kxtill' } },
  });
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'GRACE',
      graceStart: new Date(),
      graceEnd: addDays(new Date(), 2),
      expiredAt: null,
    },
  });
  console.log('test-org set to GRACE with graceEnd +2 days');
}

main().catch(console.error).finally(() => prisma.$disconnect());