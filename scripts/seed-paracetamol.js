// scripts/seed-paracetamol.js
//
// Seeds a realistic pharmacy fixture for KxNet:
//   - Product: Paracetamol 500mg
//   - Units:   tablet (base), strip (10), box (100)
//   - Branch:  Main Branch carries the product
//   - Batch:   PARA-2026-001, expires 2027-08-31, 1000 tablets, cost 4
//
// Idempotent — safe to re-run.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990';       // KxNet
const BRANCH_ID = '0fb324f4-b05b-4487-920a-c29af4ed97ce';    // Main Branch
const SKU = 'PARA-500';

async function main() {
  // ─── Product ───
  let product = await prisma.kxTillProduct.findFirst({
    where: { organizationId: ORG_ID, sku: SKU },
  });

  if (!product) {
    product = await prisma.kxTillProduct.create({
      data: {
        organizationId: ORG_ID,
        name: 'Paracetamol 500mg',
        sku: SKU,
        description: 'Pain reliever / fever reducer',
        category: 'Analgesics',
        taxRate: 0,
        cost: 4,
        trackInventory: true,
        isActive: true,
      },
    });
    console.log('Created product:', product.id, product.name);
  } else {
    console.log('Product exists:', product.id, product.name);
  }

  // ─── Units ───
  // Base: tablet (conversionQty = 1)
  // Strip: 10 tablets
  // Box:   100 tablets (10 strips)
  const unitDefs = [
    { name: 'Tablet', abbreviation: 'tab', conversionQty: 1,   price: 5,   cost: 4,   allowFractional: false, isBase: true },
    { name: 'Strip',  abbreviation: 'strp', conversionQty: 10,  price: 45,  cost: 40,  allowFractional: false },
    { name: 'Box',    abbreviation: 'box', conversionQty: 100, price: 400, cost: 400, allowFractional: false },
  ];

  const units = {};
  for (const def of unitDefs) {
    let unit = await prisma.kxTillProductUnit.findFirst({
      where: { productId: product.id, name: def.name },
    });

    if (!unit) {
      unit = await prisma.kxTillProductUnit.create({
        data: {
          productId: product.id,
          name: def.name,
          abbreviation: def.abbreviation,
          unitType: 'WHOLE',
          conversionQty: def.conversionQty,
          price: def.price,
          cost: def.cost,
          allowFractional: def.allowFractional,
          isActive: true,
        },
      });
      console.log('  Created unit:', unit.name, `(× ${def.conversionQty})`);
    } else {
      console.log('  Unit exists:', unit.name);
    }

    units[def.abbreviation] = unit;

    if (def.isBase) {
      await prisma.kxTillProduct.update({
        where: { id: product.id },
        data: { baseUnitId: unit.id },
      });
      console.log('  Set base unit:', unit.name);
    }
  }

  // ─── Branch Product ───
  let bp = await prisma.kxTillBranchProduct.findUnique({
    where: { productId_branchId: { productId: product.id, branchId: BRANCH_ID } },
  });

  if (!bp) {
    bp = await prisma.kxTillBranchProduct.create({
      data: {
        productId: product.id,
        branchId: BRANCH_ID,
        isAvailable: true,
        stock: 0,
        minStock: 0,
      },
    });
    console.log('Created branch product:', bp.id);
  } else {
    console.log('Branch product exists:', bp.id, 'stock:', bp.stock);
  }

  // ─── Branch Product Unit Prices ───
  for (const def of unitDefs) {
    const unit = units[def.abbreviation];
    const existing = await prisma.kxTillBranchProductUnitPrice.findUnique({
      where: { branchProductId_unitId: { branchProductId: bp.id, unitId: unit.id } },
    });
    if (!existing) {
      await prisma.kxTillBranchProductUnitPrice.create({
        data: { branchProductId: bp.id, unitId: unit.id, price: def.price },
      });
      console.log(`  Price set: ${unit.name} = ${def.price}`);
    }
  }

  // ─── Pharmacy Metadata (optional but realistic) ───
  const existingPharmacy = await prisma.kxTillPharmacyProduct.findUnique({
    where: { productId: product.id },
  });
  if (!existingPharmacy) {
    await prisma.kxTillPharmacyProduct.create({
      data: {
        productId: product.id,
        genericName: 'Paracetamol',
        brandName: 'Panadol',
        strength: '500mg',
        dosageForm: 'TABLET',
        route: 'ORAL',
        prescriptionCategory: 'OTC',
        packSize: '10 tablets per strip',
        storageConditions: 'Store below 25°C, protect from light',
      },
    });
    console.log('Created pharmacy metadata');
  }

  // ─── Summary ───
  console.log('\n── Summary ──');
  console.log('Product ID:        ', product.id);
  console.log('Base unit ID (tab):', units.tab.id);
  console.log('Strip unit ID:     ', units.strp.id);
  console.log('Box unit ID:       ', units.box.id);
  console.log('Branch product ID: ', bp.id);
  console.log('Branch ID:         ', BRANCH_ID);

  console.log('\nNext step: receive a batch via POST /kxtill/pharmacy/batches/receive');
}

main()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });