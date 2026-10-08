// scripts/check-refund-result.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const SALE_ID = '84160dd2-022d-42ad-8d41-74cc5521c835';
const BATCH_ID = 'e3aeec2d-74c2-4bd8-9b1b-f1a277c13023';

console.log('── Batch stock after refund ──');
const stocks = await prisma.kxTillPharmacyBatchStock.findMany({
  where: { batchId: BATCH_ID },
  include: { batch: { select: { batchNumber: true } } },
});
console.table(stocks.map(s => ({
  batchNumber: s.batch.batchNumber,
  branchProductId: s.branchProductId,
  quantityOnHand: Number(s.quantityOnHand),
})));

console.log('\n── Refund movements ──');
const movements = await prisma.kxTillPharmacyStockMovement.findMany({
  where: { batchId: BATCH_ID },
  orderBy: { createdAt: 'asc' },
});
console.table(movements.map(m => ({
  type: m.movementType,
  quantity: Number(m.quantity),
  referenceType: m.referenceType,
  at: m.createdAt.toISOString().slice(11, 19),
})));

console.log('\n── Refund batch allocations ──');
const refundAllocs = await prisma.kxTillPharmacyRefundAllocation.findMany({
  where: { batchId: BATCH_ID },
  include: { batch: { select: { batchNumber: true } } },
});
console.table(refundAllocs.map(a => ({
  batchNumber: a.batch.batchNumber,
  quantity: Number(a.quantity),
})));

await prisma.$disconnect();