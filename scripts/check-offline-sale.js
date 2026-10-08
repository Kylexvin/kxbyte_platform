import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const SALE_ITEM_ID = '0366de15-18f9-46d2-b926-e0076bd6bd99';
const SALE_ID = '61aa60e2-565e-47a2-9083-4c3b0ff31743';

console.log('── Batch allocations ──');
const allocs = await prisma.kxTillPharmacySaleBatchAllocation.findMany({
  where: { saleItemId: SALE_ITEM_ID },
  include: { batch: { select: { batchNumber: true } } },
});
console.table(allocs.map(a => ({
  batchNumber: a.batch.batchNumber,
  quantity: Number(a.quantity),
  refundedQuantity: Number(a.refundedQuantity),
})));

console.log('\n── SOLD movements for this sale ──');
const movements = await prisma.kxTillPharmacyStockMovement.findMany({
  where: { referenceId: SALE_ID },
  include: { batch: { select: { batchNumber: true } } },
});
console.table(movements.map(m => ({
  batchNumber: m.batch.batchNumber,
  type: m.movementType,
  quantity: Number(m.quantity),
  referenceType: m.referenceType,
})));

await prisma.$disconnect();