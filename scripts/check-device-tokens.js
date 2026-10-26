// scripts/check-device-tokens.js
//
// Prints the most recent device_tokens rows.
//   node scripts/check-device-tokens.js
//   node scripts/check-device-tokens.js 25
//
// Read-only.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const LIMIT = Number(process.argv[2] || 10);

async function main() {
  const rows = await prisma.deviceToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });

  if (rows.length === 0) {
    console.log('(no device tokens)');
    return;
  }

  console.table(
    rows.map((r) => ({
      id: r.id.slice(0, 8),
      userId: (r.userId || '').slice(0, 8),
      product: r.productKey,
      platform: r.platform,
      label: r.deviceLabel || '-',
      token: r.token.slice(0, 24) + '…',
      tokenLen: r.token.length,
      lastSeenAt: r.lastSeenAt.toISOString().slice(0, 19).replace('T', ' '),
    }))
  );
}

main()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });