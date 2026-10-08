import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const SALE_ITEM_ID = '10d8a3e3-cfb0-4510-a9c9-9770847a1a46';

const allocs = await prisma.kxTillPharmacySaleBatchAllocation.findMany({
  where: { saleItemId: SALE_ITEM_ID },
  include: { batch: { select: { batchNumber: true, expiryDate: true } } },
});

console.log('Allocations for sale item', SALE_ITEM_ID);
console.table(allocs.map(a => ({
  allocationId: a.id,
  batchId: a.batchId,
  batchNumber: a.batch.batchNumber,
  quantity: Number(a.quantity),
  refundedQuantity: Number(a.refundedQuantity || 0),
  remainingRefundable: Number(a.quantity) - Number(a.refundedQuantity || 0),
})));

await prisma.$disconnect();