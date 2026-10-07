// scripts/test-fefo.js
//
// Standalone test for the FEFO allocator.
// Opens a transaction, calls allocateFEFO, prints the result, ROLLS BACK.
// No data is left behind.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import fefoService from '../src/modules/products/kxtill/verticals/pharmacy/services/fefo.service.js';

const BRANCH_PRODUCT_ID = '8c24998a-d438-40f1-8389-e985600675b5'; // Tea Leaves @ Main Branch

const run = async () => {
  console.log('── Pre-check: batch stock for this branch product ──');
  const before = await prisma.kxTillPharmacyBatchStock.findMany({
    where: { branchProductId: BRANCH_PRODUCT_ID },
    include: { batch: { select: { batchNumber: true, expiryDate: true } } },
    orderBy: { batch: { expiryDate: 'asc' } },
  });
  console.table(
    before.map((bs) => ({
      batchNumber: bs.batch.batchNumber,
      expiryDate: bs.batch.expiryDate.toISOString().slice(0, 10),
      quantityOnHand: Number(bs.quantityOnHand),
      status: bs.status,
    }))
  );

  console.log('\n── Test 1: Happy path — request 300 ──');
  try {
    const result = await prisma.$transaction(async (tx) => {
      const alloc = await fefoService.allocateFEFO(tx, {
        branchProductId: BRANCH_PRODUCT_ID,
        baseQuantity: 300,
      });
      // Roll back on purpose
      throw { __rollback: true, alloc };
    });
  } catch (e) {
    if (e.__rollback) {
      console.log('Allocations:');
      console.table(e.alloc.allocations);
      console.log('Total allocated:', e.alloc.totalAllocated);
    } else {
      console.error('FAIL:', e.message);
    }
  }

  console.log('\n── Test 2: Insufficient — request 5000 ──');
  try {
    await prisma.$transaction(async (tx) => {
      await fefoService.allocateFEFO(tx, {
        branchProductId: BRANCH_PRODUCT_ID,
        baseQuantity: 5000,
      });
    });
    console.log('⚠️  Should have thrown');
  } catch (e) {
    if (e.code === 'INSUFFICIENT_STOCK') {
      console.log('Correctly rejected:');
      console.log('  requested:', e.requested);
      console.log('  available:', e.available);
      console.log('  message:  ', e.message);
    } else {
      console.error('Unexpected error:', e.message);
    }
  }

  console.log('\n── Post-check: batch stock unchanged (nothing committed) ──');
  const after = await prisma.kxTillPharmacyBatchStock.findMany({
    where: { branchProductId: BRANCH_PRODUCT_ID },
    include: { batch: { select: { batchNumber: true } } },
  });
  console.table(
    after.map((bs) => ({
      batchNumber: bs.batch.batchNumber,
      quantityOnHand: Number(bs.quantityOnHand),
    }))
  );
};

run()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });