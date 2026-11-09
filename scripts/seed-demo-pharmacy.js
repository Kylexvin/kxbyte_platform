// scripts/seed-demo-pharmacy.js
//
// Seed a demo pharmacy with realistic inventory:
//   - 27 drugs across 12 categories
//   - Multiple units per drug (base + strip + box, etc.)
//   - Batch stock with varied expiry dates
//   - Some batches expiring soon (30-60 days) to demo alerts
//   - Some already near depletion
//
// Idempotent — matches by SKU. Safe to re-run.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = '57a669af-58ba-4b2f-9615-36da4e5d72e0';
const BRANCH_ID = '559f8cff-bed0-4a9e-a578-7ac21591c4d5';
const USER_ID = 'c55859dd-7ecf-4a54-8a47-718130511199';

// ─── helpers ───
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

// Each drug defines:
//   sku, name, category, cost, base unit, extra units, pharmacy metadata,
//   and 1-2 batches with { batchNumber, expiryDaysFromNow, quantity, cost }
const DRUGS = [
  // ─── Antibiotics ───
  {
    sku: 'AMOX-500',
    name: 'Amoxicillin 500mg',
    category: 'Antibiotics',
    cost: 5,
    baseUnit: { name: 'Capsule', abbreviation: 'cap', price: 8 },
    units: [
      { name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 75 },
      { name: 'Box', abbreviation: 'box', conversionQty: 100, price: 700 },
    ],
    pharmacy: {
      genericName: 'Amoxicillin',
      brandName: 'Amoxil',
      strength: '500mg',
      dosageForm: 'CAPSULE',
      route: 'ORAL',
      prescriptionCategory: 'POM',
      packSize: '10 capsules per strip',
      storageConditions: 'Store below 25°C',
    },
    batches: [
      { batchNumber: 'AMOX-2026-001', expiryDaysFromNow: 45, quantity: 800, cost: 5 },
      { batchNumber: 'AMOX-2026-002', expiryDaysFromNow: 400, quantity: 1500, cost: 5 },
    ],
  },
  {
    sku: 'AZI-500',
    name: 'Azithromycin 500mg',
    category: 'Antibiotics',
    cost: 18,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 28 },
    units: [{ name: 'Pack', abbreviation: 'pkt', conversionQty: 3, price: 80 }],
    pharmacy: {
      genericName: 'Azithromycin',
      brandName: 'Zithromax',
      strength: '500mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'AZI-2026-001', expiryDaysFromNow: 200, quantity: 300, cost: 18 },
    ],
  },
  {
    sku: 'CIP-500',
    name: 'Ciprofloxacin 500mg',
    category: 'Antibiotics',
    cost: 6,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 12 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 110 }],
    pharmacy: {
      genericName: 'Ciprofloxacin',
      strength: '500mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'CIP-2026-001', expiryDaysFromNow: 300, quantity: 500, cost: 6 },
    ],
  },

  // ─── Analgesics / Antipyretics ───
  {
    sku: 'PARA-500',
    name: 'Paracetamol 500mg',
    category: 'Analgesics',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 5 },
    units: [
      { name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 45 },
      { name: 'Box', abbreviation: 'box', conversionQty: 100, price: 400 },
    ],
    pharmacy: {
      genericName: 'Paracetamol',
      brandName: 'Panadol',
      strength: '500mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
      packSize: '10 tablets per strip',
    },
    batches: [
      { batchNumber: 'PARA-2026-001', expiryDaysFromNow: 60, quantity: 2000, cost: 3 },
      { batchNumber: 'PARA-2026-002', expiryDaysFromNow: 365, quantity: 3000, cost: 3 },
    ],
  },
  {
    sku: 'IBU-400',
    name: 'Ibuprofen 400mg',
    category: 'Analgesics',
    cost: 4,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 7 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 60 }],
    pharmacy: {
      genericName: 'Ibuprofen',
      strength: '400mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'IBU-2026-001', expiryDaysFromNow: 240, quantity: 1200, cost: 4 },
    ],
  },
  {
    sku: 'ASP-300',
    name: 'Aspirin 300mg',
    category: 'Analgesics',
    cost: 2,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 4 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 35 }],
    pharmacy: {
      genericName: 'Aspirin',
      strength: '300mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'ASP-2026-001', expiryDaysFromNow: 500, quantity: 800, cost: 2 },
    ],
  },

  // ─── Antimalarials ───
  {
    sku: 'COA-20-120',
    name: 'Coartem 20/120mg',
    category: 'Antimalarials',
    cost: 45,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 65 },
    units: [{ name: 'Pack', abbreviation: 'pkt', conversionQty: 6, price: 380 }],
    pharmacy: {
      genericName: 'Artemether/Lumefantrine',
      brandName: 'Coartem',
      strength: '20/120mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
      packSize: '6 tablets per dose pack',
    },
    batches: [
      { batchNumber: 'COA-2026-001', expiryDaysFromNow: 90, quantity: 200, cost: 45 },
      { batchNumber: 'COA-2026-002', expiryDaysFromNow: 450, quantity: 400, cost: 45 },
    ],
  },
  {
    sku: 'QUI-300',
    name: 'Quinine 300mg',
    category: 'Antimalarials',
    cost: 8,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 15 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 140 }],
    pharmacy: {
      genericName: 'Quinine',
      strength: '300mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'QUI-2026-001', expiryDaysFromNow: 30, quantity: 150, cost: 8 },
    ],
  },

  // ─── Antihistamines ───
  {
    sku: 'CET-10',
    name: 'Cetirizine 10mg',
    category: 'Antihistamines',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 5 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 40 }],
    pharmacy: {
      genericName: 'Cetirizine',
      strength: '10mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'CET-2026-001', expiryDaysFromNow: 320, quantity: 600, cost: 3 },
    ],
  },
  {
    sku: 'LOR-10',
    name: 'Loratadine 10mg',
    category: 'Antihistamines',
    cost: 4,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 7 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 60 }],
    pharmacy: {
      genericName: 'Loratadine',
      strength: '10mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'LOR-2026-001', expiryDaysFromNow: 400, quantity: 500, cost: 4 },
    ],
  },

  // ─── Gastro ───
  {
    sku: 'OME-20',
    name: 'Omeprazole 20mg',
    category: 'Gastro',
    cost: 6,
    baseUnit: { name: 'Capsule', abbreviation: 'cap', price: 10 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 90 }],
    pharmacy: {
      genericName: 'Omeprazole',
      strength: '20mg',
      dosageForm: 'CAPSULE',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'OME-2026-001', expiryDaysFromNow: 180, quantity: 900, cost: 6 },
    ],
  },
  {
    sku: 'ORS-PKT',
    name: 'ORS Sachets',
    category: 'Gastro',
    cost: 12,
    baseUnit: { name: 'Sachet', abbreviation: 'sch', price: 20 },
    units: [{ name: 'Box', abbreviation: 'box', conversionQty: 10, price: 180 }],
    pharmacy: {
      genericName: 'Oral Rehydration Salts',
      strength: '20.5g',
      dosageForm: 'POWDER',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'ORS-2026-001', expiryDaysFromNow: 500, quantity: 1000, cost: 12 },
    ],
  },

  // ─── Cardiovascular ───
  {
    sku: 'AML-5',
    name: 'Amlodipine 5mg',
    category: 'Cardiovascular',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 6 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 55 }],
    pharmacy: {
      genericName: 'Amlodipine',
      strength: '5mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'AML-2026-001', expiryDaysFromNow: 270, quantity: 700, cost: 3 },
    ],
  },
  {
    sku: 'ATE-50',
    name: 'Atenolol 50mg',
    category: 'Cardiovascular',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 6 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 55 }],
    pharmacy: {
      genericName: 'Atenolol',
      strength: '50mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'ATE-2026-001', expiryDaysFromNow: 200, quantity: 500, cost: 3 },
    ],
  },

  // ─── Diabetes ───
  {
    sku: 'MET-500',
    name: 'Metformin 500mg',
    category: 'Diabetes',
    cost: 2,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 4 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 35 }],
    pharmacy: {
      genericName: 'Metformin',
      strength: '500mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'MET-2026-001', expiryDaysFromNow: 350, quantity: 1500, cost: 2 },
    ],
  },
  {
    sku: 'GLI-5',
    name: 'Glibenclamide 5mg',
    category: 'Diabetes',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 6 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 55 }],
    pharmacy: {
      genericName: 'Glibenclamide',
      strength: '5mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'GLI-2026-001', expiryDaysFromNow: 280, quantity: 400, cost: 3 },
    ],
  },

  // ─── Vitamins / Supplements ───
  {
    sku: 'VIT-C-500',
    name: 'Vitamin C 500mg',
    category: 'Vitamins',
    cost: 2,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 4 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 35 }],
    pharmacy: {
      genericName: 'Ascorbic Acid',
      strength: '500mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'VTC-2026-001', expiryDaysFromNow: 600, quantity: 2000, cost: 2 },
    ],
  },
  {
    sku: 'FOL-5',
    name: 'Folic Acid 5mg',
    category: 'Vitamins',
    cost: 2,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 4 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 35 }],
    pharmacy: {
      genericName: 'Folic Acid',
      strength: '5mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'FOL-2026-001', expiryDaysFromNow: 550, quantity: 1200, cost: 2 },
    ],
  },
  {
    sku: 'MVT-SYR-200',
    name: 'Multivitamin Syrup 200ml',
    category: 'Vitamins',
    cost: 130,
    baseUnit: { name: 'Bottle', abbreviation: 'btl', price: 200 },
    units: [],
    pharmacy: {
      genericName: 'Multivitamin',
      strength: '200ml',
      dosageForm: 'SYRUP',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'MVT-2026-001', expiryDaysFromNow: 300, quantity: 120, cost: 130 },
    ],
  },

  // ─── Topical / Dermatology ───
  {
    sku: 'BET-CRM-15',
    name: 'Betamethasone Cream 15g',
    category: 'Dermatology',
    cost: 95,
    baseUnit: { name: 'Tube', abbreviation: 'tube', price: 150 },
    units: [],
    pharmacy: {
      genericName: 'Betamethasone',
      strength: '0.05%',
      dosageForm: 'CREAM',
      route: 'TOPICAL',
      prescriptionCategory: 'POM',
      packSize: '15g',
    },
    batches: [
      { batchNumber: 'BET-2026-001', expiryDaysFromNow: 400, quantity: 80, cost: 95 },
    ],
  },

  // ─── Ophthalmology ───
  {
    sku: 'GEN-EYE-5',
    name: 'Gentamicin Eye Drops 5ml',
    category: 'Ophthalmology',
    cost: 65,
    baseUnit: { name: 'Bottle', abbreviation: 'btl', price: 100 },
    units: [],
    pharmacy: {
      genericName: 'Gentamicin',
      strength: '0.3%',
      dosageForm: 'DROPS',
      route: 'OPHTHALMIC',
      prescriptionCategory: 'POM',
      packSize: '5ml',
    },
    batches: [
      { batchNumber: 'GEN-2026-001', expiryDaysFromNow: 250, quantity: 60, cost: 65 },
    ],
  },

  // ─── Respiratory ───
  {
    sku: 'COU-SYR-100',
    name: 'Cough Syrup 100ml',
    category: 'Respiratory',
    cost: 85,
    baseUnit: { name: 'Bottle', abbreviation: 'btl', price: 130 },
    units: [],
    pharmacy: {
      genericName: 'Dextromethorphan',
      strength: '100ml',
      dosageForm: 'SYRUP',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'COU-2026-001', expiryDaysFromNow: 20, quantity: 40, cost: 85 },
      { batchNumber: 'COU-2026-002', expiryDaysFromNow: 400, quantity: 100, cost: 85 },
    ],
  },

  // ─── Hypertension (extra for demo) ───
  {
    sku: 'LOS-50',
    name: 'Losartan 50mg',
    category: 'Cardiovascular',
    cost: 5,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 9 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 85 }],
    pharmacy: {
      genericName: 'Losartan',
      strength: '50mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'LOS-2026-001', expiryDaysFromNow: 320, quantity: 800, cost: 5 },
    ],
  },

  // ─── Antifungals ───
  {
    sku: 'FLU-150',
    name: 'Fluconazole 150mg',
    category: 'Antifungals',
    cost: 40,
    baseUnit: { name: 'Capsule', abbreviation: 'cap', price: 65 },
    units: [],
    pharmacy: {
      genericName: 'Fluconazole',
      strength: '150mg',
      dosageForm: 'CAPSULE',
      route: 'ORAL',
      prescriptionCategory: 'POM',
    },
    batches: [
      { batchNumber: 'FLU-2026-001', expiryDaysFromNow: 180, quantity: 200, cost: 40 },
    ],
  },

  // ─── Muscle relaxants ───
  {
    sku: 'DIC-50',
    name: 'Diclofenac 50mg',
    category: 'Analgesics',
    cost: 3,
    baseUnit: { name: 'Tablet', abbreviation: 'tab', price: 6 },
    units: [{ name: 'Strip', abbreviation: 'strp', conversionQty: 10, price: 55 }],
    pharmacy: {
      genericName: 'Diclofenac',
      strength: '50mg',
      dosageForm: 'TABLET',
      route: 'ORAL',
      prescriptionCategory: 'OTC',
    },
    batches: [
      { batchNumber: 'DIC-2026-001', expiryDaysFromNow: 400, quantity: 1000, cost: 3 },
    ],
  },
];

// ─── main ───
async function main() {
  console.log(`Seeding demo pharmacy for org ${ORG_ID}, branch ${BRANCH_ID}\n`);

  // Verify org + branch
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('Organization not found');
  const branch = await prisma.branch.findUnique({ where: { id: BRANCH_ID } });
  if (!branch) throw new Error('Branch not found');

  console.log(`Org: ${org.name} | Branch: ${branch.name}\n`);

  let created = 0;
  let skipped = 0;
  let batchCount = 0;

  for (const drug of DRUGS) {
    const existing = await prisma.kxTillProduct.findFirst({
      where: { organizationId: ORG_ID, sku: drug.sku },
    });

    if (existing) {
      console.log(`[skip] ${drug.sku} — ${drug.name} already exists`);
      skipped++;
      continue;
    }

    // 1. Create product
    const product = await prisma.kxTillProduct.create({
      data: {
        organizationId: ORG_ID,
        name: drug.name,
        sku: drug.sku,
        category: drug.category,
        cost: drug.cost,
        taxRate: 0,
        trackInventory: true,
        isActive: true,
      },
    });

    // 2. Create base unit
    const baseUnit = await prisma.kxTillProductUnit.create({
      data: {
        productId: product.id,
        name: drug.baseUnit.name,
        abbreviation: drug.baseUnit.abbreviation,
        unitType: 'WHOLE',
        conversionQty: 1,
        price: drug.baseUnit.price,
        cost: drug.cost,
        allowFractional: false,
        isActive: true,
      },
    });

    // Set base unit
    await prisma.kxTillProduct.update({
      where: { id: product.id },
      data: { baseUnitId: baseUnit.id },
    });

    // 3. Create extra units
    for (const u of drug.units) {
      await prisma.kxTillProductUnit.create({
        data: {
          productId: product.id,
          name: u.name,
          abbreviation: u.abbreviation,
          unitType: 'PACKAGED',
          conversionQty: u.conversionQty,
          price: u.price,
          cost: null,
          allowFractional: false,
          isActive: true,
        },
      });
    }

    // 4. Create pharmacy metadata
    await prisma.kxTillPharmacyProduct.create({
      data: {
        productId: product.id,
        ...drug.pharmacy,
      },
    });

    // 5. Create branch product
    const branchProduct = await prisma.kxTillBranchProduct.create({
      data: {
        productId: product.id,
        branchId: BRANCH_ID,
        displayName: drug.name,
        stock: 0,
        minStock: 5,
        isAvailable: true,
      },
    });

    // 6. Create batches + batch stock
    let totalStock = 0;
    for (const b of drug.batches) {
      const batch = await prisma.kxTillPharmacyBatch.upsert({
        where: {
          productId_batchNumber_expiryDate: {
            productId: product.id,
            batchNumber: b.batchNumber,
            expiryDate: daysFromNow(b.expiryDaysFromNow),
          },
        },
        update: {},
        create: {
          productId: product.id,
          batchNumber: b.batchNumber,
          expiryDate: daysFromNow(b.expiryDaysFromNow),
        },
      });

      await prisma.kxTillPharmacyBatchStock.upsert({
        where: {
          batchId_branchProductId: {
            batchId: batch.id,
            branchProductId: branchProduct.id,
          },
        },
        update: {
          quantityOnHand: { increment: b.quantity },
        },
        create: {
          batchId: batch.id,
          branchProductId: branchProduct.id,
          quantityOnHand: b.quantity,
          unitCost: b.cost,
          sellingPrice: drug.baseUnit.price,
          status: 'AVAILABLE',
        },
      });

      totalStock += b.quantity;
      batchCount++;
    }

    // 7. Update branch product aggregate
    await prisma.kxTillBranchProduct.update({
      where: { id: branchProduct.id },
      data: { stock: totalStock },
    });

    console.log(
      `[created] ${drug.sku} — ${drug.name} | ${totalStock} units across ${drug.batches.length} batch(es)`
    );
    created++;
  }

  console.log(`\n── Summary ──`);
  console.log(`Products created: ${created}`);
  console.log(`Products skipped: ${skipped}`);
  console.log(`Batches created:  ${batchCount}`);
}

main()
  .catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });