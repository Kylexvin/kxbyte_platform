// scripts/seed-kxnet-products.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990';

// 30 products with base unit + one alternate unit + cost/price
const PRODUCTS = [
  { name: 'Sugar',              sku: 'SGR-001', category: 'Groceries', cost: 140, base: { name: 'Kg',          abbr: 'kg',    type: 'MEASURED',  price: 160, allowFractional: true },
                                                          alt:  { name: '1/2 kg',      abbr: '1/2kg', type: 'PACKAGED',  price: 80,  conversionQty: 0.5 } },
  { name: 'Maize Flour 2kg',    sku: 'MZF-002', category: 'Groceries', cost: 130, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 155 },
                                                          alt:  { name: 'Carton (12)', abbr: 'ctn',   type: 'PACKAGED',  price: 1800, conversionQty: 12 } },
  { name: 'Wheat Flour 2kg',    sku: 'WHF-003', category: 'Groceries', cost: 145, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 175 } },
  { name: 'Rice 5kg',           sku: 'RIC-004', category: 'Groceries', cost: 650, base: { name: 'Bag',         abbr: 'bag',   type: 'PACKAGED',  price: 780 } },
  { name: 'Cooking Oil 1L',     sku: 'OIL-005', category: 'Groceries', cost: 280, base: { name: 'Bottle',      abbr: 'btl',   type: 'WHOLE',     price: 330 } },
  { name: 'Cooking Oil 3L',     sku: 'OIL-006', category: 'Groceries', cost: 780, base: { name: 'Bottle',      abbr: 'btl',   type: 'WHOLE',     price: 900 } },
  { name: 'Salt 1kg',           sku: 'SLT-007', category: 'Groceries', cost: 20,  base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 30 } },
  { name: 'Tea Leaves 500g',    sku: 'TEA-008', category: 'Beverages', cost: 230, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 280 } },
  { name: 'Coffee 100g',        sku: 'COF-009', category: 'Beverages', cost: 210, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 260 } },
  { name: 'Milk 500ml',         sku: 'MLK-010', category: 'Beverages', cost: 50,  base: { name: 'Packet',      abbr: 'pkt',   type: 'WHOLE',     price: 60 } },
  { name: 'Apple Juice 1L',     sku: 'APJ-011', category: 'Beverages', cost: 180, base: { name: 'Bottle',      abbr: 'btl',   type: 'WHOLE',     price: 200 } },
  { name: 'Mango Juice 1L',     sku: 'MGJ-012', category: 'Beverages', cost: 180, base: { name: 'Bottle',      abbr: 'btl',   type: 'WHOLE',     price: 200 } },
  { name: 'Soda 500ml',         sku: 'SDA-013', category: 'Beverages', cost: 40,  base: { name: 'Bottle',      abbr: 'btl',   type: 'WHOLE',     price: 60 } },
  { name: 'Bread 400g',         sku: 'BRD-014', category: 'Bakery',    cost: 50,  base: { name: 'Loaf',        abbr: 'loaf',  type: 'WHOLE',     price: 65 } },
  { name: 'Blueband 250g',      sku: 'BLB-015', category: 'Groceries', cost: 130, base: { name: 'Tub',         abbr: 'tub',   type: 'PACKAGED',  price: 200 } },
  { name: 'Blueband 500g',      sku: 'BLB-016', category: 'Groceries', cost: 250, base: { name: 'Tub',         abbr: 'tub',   type: 'PACKAGED',  price: 340 } },
  { name: 'Peanut Butter 500g', sku: 'PNB-017', category: 'Groceries', cost: 280, base: { name: 'Jar',         abbr: 'jar',   type: 'PACKAGED',  price: 360 } },
  { name: 'Jam 500g',           sku: 'JAM-018', category: 'Groceries', cost: 240, base: { name: 'Jar',         abbr: 'jar',   type: 'PACKAGED',  price: 320 } },
  { name: 'Biscuits 200g',      sku: 'BSC-019', category: 'Snacks',    cost: 60,  base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 85 } },
  { name: 'Crisps 100g',        sku: 'CRS-020', category: 'Snacks',    cost: 70,  base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 100 } },
  { name: 'Chocolate 100g',     sku: 'CHO-021', category: 'Snacks',    cost: 120, base: { name: 'Bar',         abbr: 'bar',   type: 'PACKAGED',  price: 160 } },
  { name: 'Detergent 1kg',      sku: 'DTG-022', category: 'Household', cost: 220, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 290 } },
  { name: 'Detergent 500g',     sku: 'DTG-023', category: 'Household', cost: 120, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 160 } },
  { name: 'Bar Soap 250g',      sku: 'SOP-024', category: 'Household', cost: 80,  base: { name: 'Bar',         abbr: 'bar',   type: 'WHOLE',     price: 110 } },
  { name: 'Toothpaste 100ml',   sku: 'TPT-025', category: 'Household', cost: 130, base: { name: 'Tube',        abbr: 'tube',  type: 'PACKAGED',  price: 180 } },
  { name: 'Toilet Paper 4pk',   sku: 'TPR-026', category: 'Household', cost: 90,  base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 130 } },
  { name: 'Maize Flour 1kg',    sku: 'MZF-027', category: 'Groceries', cost: 70,  base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 90 } },
  { name: 'Sugar 1kg',          sku: 'SGR-028', category: 'Groceries', cost: 150, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 175 } },
  { name: 'Unga 2kg',           sku: 'UNG-029', category: 'Groceries', cost: 135, base: { name: 'Pack',        abbr: 'pkt',   type: 'PACKAGED',  price: 165 } },
  { name: 'Milk 1L',            sku: 'MLK-030', category: 'Beverages', cost: 90,  base: { name: 'Packet',      abbr: 'pkt',   type: 'WHOLE',     price: 110 } },
];

const randomStock = (base) => Math.floor(20 + Math.random() * 80) * base;

async function main() {
  console.log('[seed-products] starting for org', ORG_ID);

  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('Organization not found');

  const branches = await prisma.branch.findMany({
    where: { organizationId: ORG_ID, isActive: true },
  });
  if (!branches.length) throw new Error('No active branches for org');

  console.log(`[seed-products] branches: ${branches.map((b) => b.name).join(', ')}`);

  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    // Skip if SKU exists in this org
    const existing = p.sku
      ? await prisma.kxTillProduct.findFirst({
          where: { organizationId: ORG_ID, sku: p.sku },
        })
      : null;

    if (existing) {
      skipped++;
      continue;
    }

    // 1. Create product
    const product = await prisma.kxTillProduct.create({
      data: {
        organizationId: ORG_ID,
        name: p.name,
        sku: p.sku,
        description: null,
        category: p.category,
        taxRate: 0,
        cost: p.cost,
        trackInventory: true,
        isActive: true,
      },
    });

    // 2. Base unit
    const baseUnit = await prisma.kxTillProductUnit.create({
      data: {
        productId: product.id,
        name: p.base.name,
        abbreviation: p.base.abbr,
        unitType: p.base.type,
        conversionQty: 1,
        price: p.base.price,
        cost: p.cost,
        allowFractional: p.base.allowFractional || false,
        isActive: true,
      },
    });

    // 3. Alternate unit (optional)
    if (p.alt) {
      await prisma.kxTillProductUnit.create({
        data: {
          productId: product.id,
          name: p.alt.name,
          abbreviation: p.alt.abbr,
          unitType: p.alt.type,
          conversionQty: p.alt.conversionQty || 1,
          price: p.alt.price,
          cost: p.alt.cost || null,
          allowFractional: false,
          isActive: true,
        },
      });
    }

    // 4. Link base unit back to product
    await prisma.kxTillProduct.update({
      where: { id: product.id },
      data: { baseUnitId: baseUnit.id },
    });

    // 5. Branch products (one per active branch)
    for (const branch of branches) {
      await prisma.kxTillBranchProduct.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          displayName: p.name,
          stock: randomStock(1),
          minStock: 5,
          isAvailable: true,
        },
      });
    }

    created++;
    console.log(`  ✓ ${p.name} (${p.sku})`);
  }

  console.log(`[seed-products] done. created=${created}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error('[seed-products] fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());