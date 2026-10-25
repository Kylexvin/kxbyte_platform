// scripts/check-notifications.js
//
// Inspects the notifications table for KxNet. Prints:
//   - The most recent N rows (default 10)
//   - Any shift_variance rows specifically
//   - Any low_stock / out_of_stock rows specifically
//
// Usage:
//   node scripts/check-notifications.js
//   node scripts/check-notifications.js 25
//
// Safe — read-only.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990'; // KxNet
const LIMIT = Number(process.argv[2] || 10);

async function main() {
  console.log(`── Last ${LIMIT} notifications for ${ORG_ID} ──`);
  const rows = await prisma.notification.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      type: true,
      productKey: true,
      userId: true,
      title: true,
      readAt: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    console.log('(none)');
  } else {
    console.table(
      rows.map((r) => ({
        id: r.id.slice(0, 8),
        type: r.type,
        product: r.productKey ?? '-',
        read: r.readAt ? 'yes' : 'no',
        title: (r.title || '').slice(0, 42),
        at: r.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      }))
    );
  }

  console.log('\n── shift_variance rows ──');
  const variance = await prisma.notification.findMany({
    where: { organizationId: ORG_ID, type: 'shift_variance' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      resourceId: true,
      userId: true,
      createdAt: true,
    },
  });
  if (variance.length === 0) {
    console.log('(none)');
  } else {
    console.table(
      variance.map((r) => ({
        id: r.id.slice(0, 8),
        shiftId: (r.resourceId || '').slice(0, 8),
        userId: (r.userId || '').slice(0, 8),
        at: r.createdAt.toISOString(),
      }))
    );
  }

  console.log('\n── low_stock + out_of_stock rows ──');
  const stock = await prisma.notification.findMany({
    where: {
      organizationId: ORG_ID,
      type: { in: ['low_stock', 'out_of_stock'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      resourceId: true,
      createdAt: true,
    },
  });
  if (stock.length === 0) {
    console.log('(none)');
  } else {
    console.table(
      stock.map((r) => ({
        id: r.id.slice(0, 8),
        type: r.type,
        branchProductId: (r.resourceId || '').slice(0, 8),
        at: r.createdAt.toISOString(),
      }))
    );
  }
}

main()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });