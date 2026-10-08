import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const SALE_ID = '84160dd2-022d-42ad-8d41-74cc5521c835';
const SALE_ITEM_ID = '10d8a3e3-cfb0-4510-a9c9-9770847a1a46';
const BRANCH_PRODUCT_ID = '007bb4f3-5556-4734-a18e-0ac413d78c39';

console.log('── Sale Batch Allocations ──');
const allocs = await prisma.kxTillPharmacySaleBatchAllocation.findMany({
  where: { saleItemId: SALE_ITEM_ID },
  include: { batch: { select: { batchNumber: true, expiryDate: true } } },
});
console.table(allocs.map(a => ({
  batchNumber: a.batch.batchNumber,
  expiryDate: a.batch.expiryDate.toISOString().slice(0, 10),
  quantity: Number(a.quantity),
  unitCost: Number(a.unitCost),
})));

console.log('\n── Batch Stock (after sale) ──');
const stocks = await prisma.kxTillPharmacyBatchStock.findMany({
  where: { branchProductId: BRANCH_PRODUCT_ID },
  include: { batch: { select: { batchNumber: true } } },
  orderBy: { batch: { expiryDate: 'asc' } },
});
console.table(stocks.map(s => ({
  batchNumber: s.batch.batchNumber,
  quantityOnHand: Number(s.quantityOnHand),
})));

console.log('\n── SOLD Movements ──');
const movements = await prisma.kxTillPharmacyStockMovement.findMany({
  where: { referenceId: SALE_ID },
  include: { batch: { select: { batchNumber: true } } },
});
console.table(movements.map(m => ({
  batchNumber: m.batch.batchNumber,
  type: m.movementType,
  quantity: Number(m.quantity),
})));

console.log('\n── Branch Product (aggregate) ──');
const bp = await prisma.kxTillBranchProduct.findUnique({
  where: { id: BRANCH_PRODUCT_ID },
  select: { stock: true },
});
console.log('branchProduct.stock:', Number(bp.stock));

await prisma.$disconnect();