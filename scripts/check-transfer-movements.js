import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const TRANSFER_ID = 'd8273979-09a8-40a9-ac55-7c17fd71a35a';

const movements = await prisma.kxTillPharmacyStockMovement.findMany({
  where: { referenceId: TRANSFER_ID },
  include: { batch: { select: { batchNumber: true } } },
  orderBy: { createdAt: 'asc' },
});

console.log('Transfer movements:');
console.table(movements.map(m => ({
  batchNumber: m.batch.batchNumber,
  type: m.movementType,
  quantity: Number(m.quantity),
  referenceType: m.referenceType,
})));

await prisma.$disconnect();