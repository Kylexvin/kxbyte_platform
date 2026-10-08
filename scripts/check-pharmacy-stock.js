import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const BRANCH_PRODUCT_ID = '007bb4f3-5556-4734-a18e-0ac413d78c39';

console.log('── All SOLD movements for this branch product ──');
const movements = await prisma.kxTillPharmacyStockMovement.findMany({
  where: {
    batchStock: { branchProductId: BRANCH_PRODUCT_ID },
  },
  include: { batch: { select: { batchNumber: true } } },
  orderBy: { createdAt: 'asc' },
});
console.table(movements.map(m => ({
  batchNumber: m.batch.batchNumber,
  type: m.movementType,
  quantity: Number(m.quantity),
  reference: m.referenceId ? m.referenceId.slice(0, 8) : 'n/a',
  at: m.createdAt.toISOString().slice(11, 19),
})));

console.log('\n── All allocations for this branch product ──');
const allocs = await prisma.kxTillPharmacySaleBatchAllocation.findMany({
  where: {
    batchStock: { branchProductId: BRANCH_PRODUCT_ID },
  },
  include: { batch: { select: { batchNumber: true } } },
  orderBy: { createdAt: 'asc' },
});
console.table(allocs.map(a => ({
  batchNumber: a.batch.batchNumber,
  quantity: Number(a.quantity),
  at: a.createdAt.toISOString().slice(11, 19),
})));

await prisma.$disconnect();