import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const PRODUCT_ID = '072dff88-33b6-42e6-bebe-40598ebebbce'; // Paracetamol
const MAIN_BRANCH = '0fb324f4-b05b-4487-920a-c29af4ed97ce';
const CBD_BRANCH  = '8a135d9e-b6d9-4866-81ca-b2c95dc06a6c';

const show = async (label, branchId) => {
  const bp = await prisma.kxTillBranchProduct.findFirst({
    where: { productId: PRODUCT_ID, branchId },
    select: { id: true, stock: true },
  });
  if (!bp) { console.log(`${label}: no branch product`); return; }

  const batches = await prisma.kxTillPharmacyBatchStock.findMany({
    where: { branchProductId: bp.id, quantityOnHand: { gt: 0 } },
    include: { batch: { select: { batchNumber: true, expiryDate: true } } },
    orderBy: { batch: { expiryDate: 'asc' } },
  });

  console.log(`\n${label} — aggregate stock: ${Number(bp.stock)}`);
  console.table(batches.map(b => ({
    batchNumber: b.batch.batchNumber,
    expiry: b.batch.expiryDate.toISOString().slice(0, 10),
    qty: Number(b.quantityOnHand),
    status: b.status,
  })));
};

await show('MAIN BRANCH', MAIN_BRANCH);
await show('CBD BRANCH', CBD_BRANCH);

await prisma.$disconnect();