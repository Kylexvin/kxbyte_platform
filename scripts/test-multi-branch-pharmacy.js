// scripts/test-multi-branch-pharmacy.js
//
// Proves cross-branch isolation for pharmacy inventory:
//   1. Same batch can exist at multiple branches (separate stock rows)
//   2. A sale at Branch A does not affect Branch B
//   3. SUM(batchStock) == branchProduct.stock at each branch
//
// Run: node scripts/test-multi-branch-pharmacy.js
//
// Side effects: creates a new batch (PARA-2026-003) at two branches and
// makes one sale at Main Branch. Safe to re-run — uses upsert semantics.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import fefoService from '../src/modules/products/kxtill/verticals/pharmacy/services/fefo.service.js';

// ─── Fixtures ───
const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990';
const PRODUCT_ID = '072dff88-33b6-42e6-bebe-40598ebebbce';  // Paracetamol 500mg
const MAIN_BRANCH = '0fb324f4-b05b-4487-920a-c29af4ed97ce';
const CBD_BRANCH  = '8a135d9e-b6d9-4866-81ca-b2c95dc06a6c';
const BATCH_NUMBER = 'PARA-2026-003';
const EXPIRY = new Date('2028-06-30');
const MAIN_QTY = 100;
const CBD_QTY  = 200;
const SALE_QTY = 30;

// ─── Helpers ───
const getBranchProduct = async (branchId) => {
  return prisma.kxTillBranchProduct.findFirst({
    where: { productId: PRODUCT_ID, branchId },
    select: { id: true, stock: true },
  });
};

const getBatchStock = async (batchId, branchProductId) => {
  return prisma.kxTillPharmacyBatchStock.findUnique({
    where: { batchId_branchProductId: { batchId, branchProductId } },
    select: { id: true, quantityOnHand: true },
  });
};

const sumBatchStock = async (branchProductId) => {
  const rows = await prisma.kxTillPharmacyBatchStock.findMany({
    where: { branchProductId, status: 'AVAILABLE', quantityOnHand: { gt: 0 } },
    select: { quantityOnHand: true },
  });
  return rows.reduce((sum, r) => sum + Number(r.quantityOnHand), 0);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
};

// ─── Main ───
const main = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MULTI-BRANCH PHARMACY INVARIANT TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  // ─── Step 1 — Get current state (ensure branch products exist) ───
  console.log('── Step 1: Current state ──');

  const ensureBranchProduct = async (branchId) => {
    let bp = await getBranchProduct(branchId);
    if (!bp) {
      console.log(`   Creating branch product for branch ${branchId.slice(0, 8)}...`);
      await prisma.kxTillBranchProduct.create({
        data: {
          productId: PRODUCT_ID,
          branchId,
          isAvailable: true,
          stock: 0,
          minStock: 0,
        },
      });
      bp = await getBranchProduct(branchId);
    }
    return bp;
  };

  const mainBP = await ensureBranchProduct(MAIN_BRANCH);
  const cbdBP  = await ensureBranchProduct(CBD_BRANCH);
  assert(mainBP, 'Main Branch has branch product');
  assert(cbdBP,  'CBD Branch has branch product');

  // ─── Step 2 — Receive same batch at both branches ───
  console.log('── Step 2: Receive batch at both branches ──');

  // Get/create the batch
  const batch = await prisma.kxTillPharmacyBatch.upsert({
    where: {
      productId_batchNumber_expiryDate: {
        productId: PRODUCT_ID,
        batchNumber: BATCH_NUMBER,
        expiryDate: EXPIRY,
      },
    },
    update: {},
    create: {
      productId: PRODUCT_ID,
      batchNumber: BATCH_NUMBER,
      expiryDate: EXPIRY,
      manufacturer: 'Test Labs',
    },
  });
  console.log(`   Batch: ${batch.batchNumber} (${batch.id})`);

  // Receive at Main
  const mainBatchStockBefore = await getBatchStock(batch.id, mainBP.id);
  const mainCurrent = mainBatchStockBefore ? Number(mainBatchStockBefore.quantityOnHand) : 0;
  await prisma.kxTillPharmacyBatchStock.upsert({
    where: { batchId_branchProductId: { batchId: batch.id, branchProductId: mainBP.id } },
    update: { quantityOnHand: { increment: MAIN_QTY } },
    create: {
      batchId: batch.id,
      branchProductId: mainBP.id,
      quantityOnHand: MAIN_QTY,
      unitCost: 4,
      status: 'AVAILABLE',
    },
  });
  await prisma.kxTillBranchProduct.update({
    where: { id: mainBP.id },
    data: { stock: { increment: MAIN_QTY } },
  });
  console.log(`   Received ${MAIN_QTY} at Main`);

  // Receive at CBD
  const cbdBatchStockBefore = await getBatchStock(batch.id, cbdBP.id);
  const cbdCurrent = cbdBatchStockBefore ? Number(cbdBatchStockBefore.quantityOnHand) : 0;
  await prisma.kxTillPharmacyBatchStock.upsert({
    where: { batchId_branchProductId: { batchId: batch.id, branchProductId: cbdBP.id } },
    update: { quantityOnHand: { increment: CBD_QTY } },
    create: {
      batchId: batch.id,
      branchProductId: cbdBP.id,
      quantityOnHand: CBD_QTY,
      unitCost: 4,
      status: 'AVAILABLE',
    },
  });
  await prisma.kxTillBranchProduct.update({
    where: { id: cbdBP.id },
    data: { stock: { increment: CBD_QTY } },
  });
  console.log(`   Received ${CBD_QTY} at CBD\n`);

  // ─── Step 3 — Verify separate stock rows ───
  console.log('── Step 3: Verify separate batch-stock rows ──');
  const mainRow = await getBatchStock(batch.id, mainBP.id);
  const cbdRow  = await getBatchStock(batch.id, cbdBP.id);
  assert(mainRow, 'Main has batch stock row');
  assert(cbdRow,  'CBD has batch stock row');
  assert(mainRow.id !== cbdRow.id, 'Stock rows are DIFFERENT (per branch)');
  assert(
    Number(mainRow.quantityOnHand) === mainCurrent + MAIN_QTY,
    `Main batch stock = ${mainCurrent + MAIN_QTY}`
  );
  assert(
    Number(cbdRow.quantityOnHand) === cbdCurrent + CBD_QTY,
    `CBD batch stock = ${cbdCurrent + CBD_QTY}`
  );
  console.log('');

  // ─── Step 4 — Sell at Main Branch ───
  console.log(`── Step 4: Sell ${SALE_QTY} units at Main Branch ──`);
  const mainBPAfterReceive = await getBranchProduct(MAIN_BRANCH);
  const cbdBPAfterReceive  = await getBranchProduct(CBD_BRANCH);

  await prisma.$transaction(async (tx) => {
    const { allocations } = await fefoService.allocateFEFO(tx, {
      branchProductId: mainBP.id,
      baseQuantity: SALE_QTY,
    });
    for (const alloc of allocations) {
      await tx.kxTillPharmacyBatchStock.update({
        where: { id: alloc.batchStockId },
        data: { quantityOnHand: { decrement: alloc.quantity } },
      });
      await tx.kxTillBranchProduct.update({
        where: { id: mainBP.id },
        data: { stock: { decrement: alloc.quantity } },
      });
      await tx.kxTillPharmacyStockMovement.create({
        data: {
          batchStockId: alloc.batchStockId,
          batchId: alloc.batchId,
          movementType: 'SOLD',
          quantity: -alloc.quantity,
          referenceType: 'TEST',
          userId: 'ac37c482-4181-47a4-abfc-3ae421da9fa6',
        },
      });
    }
  });
  console.log(`   Sold ${SALE_QTY} at Main\n`);

  // ─── Step 5 — Verify isolation ───
  console.log('── Step 5: Verify cross-branch isolation ──');
  const mainAfterSale = await getBranchProduct(MAIN_BRANCH);
  const cbdAfterSale  = await getBranchProduct(CBD_BRANCH);
  const mainBatchAfter = await getBatchStock(batch.id, mainBP.id);
  const cbdBatchAfter  = await getBatchStock(batch.id, cbdBP.id);

  assert(
    Number(mainBatchAfter.quantityOnHand) === mainCurrent + MAIN_QTY - SALE_QTY,
    `Main batch stock = ${mainCurrent + MAIN_QTY - SALE_QTY} (was decremented)`
  );
  assert(
    Number(cbdBatchAfter.quantityOnHand) === cbdCurrent + CBD_QTY,
    `CBD batch stock = ${cbdCurrent + CBD_QTY} (UNCHANGED)`
  );
  assert(
    Number(mainAfterSale.stock) === mainStockBefore + MAIN_QTY - SALE_QTY,
    `Main aggregate = ${mainStockBefore + MAIN_QTY - SALE_QTY}`
  );
  assert(
    Number(cbdAfterSale.stock) === cbdStockBefore + CBD_QTY,
    `CBD aggregate = ${cbdStockBefore + CBD_QTY} (UNCHANGED)`
  );
  console.log('');

  // ─── Step 6 — Verify invariant at both branches ───
  console.log('── Step 6: Verify invariant (SUM(batchStock) == aggregate) ──');
  const mainSum = await sumBatchStock(mainBP.id);
  const cbdSum  = await sumBatchStock(cbdBP.id);
  const mainAgg = Number((await getBranchProduct(MAIN_BRANCH)).stock);
  const cbdAgg  = Number((await getBranchProduct(CBD_BRANCH)).stock);

  console.log(`   Main: batch sum = ${mainSum}, aggregate = ${mainAgg}`);
  console.log(`   CBD:  batch sum = ${cbdSum}, aggregate = ${cbdAgg}`);
  assert(mainSum === mainAgg, 'Main invariant holds');
  assert(cbdSum === cbdAgg,  'CBD invariant holds');
  console.log('');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅ ALL ASSERTIONS PASSED — multi-branch pharmacy OK');
  console.log('═══════════════════════════════════════════════════════');
};

main()
  .catch((e) => {
    console.error('\n' + e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });