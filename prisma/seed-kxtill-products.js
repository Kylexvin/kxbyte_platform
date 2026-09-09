// prisma/seed-kxtill-products.js

import prisma from '../src/database/postgres/prisma.js';

// ============================================================
// PRODUCT DATA (same as before)
// ============================================================

const productData = [
  {
    name: "Omo 1kg",
    sku: "OMO-001",
    category: "Detergent",
    cost: 130,
    price: 180,
    stock: 100,
    minStock: 10,
    baseUnit: {
      name: "Piece",
      abbreviation: "pc",
      unitType: "WHOLE",
      price: 180,
      cost: 130,
      allowFractional: false,
    },
  },
  {
    name: "Bar Soap",
    sku: "SOAP-001",
    category: "Household",
    cost: 90,
    price: 120,
    stock: 100,
    minStock: 10,
    baseUnit: {
      name: "Piece",
      abbreviation: "pc",
      unitType: "WHOLE",
      price: 120,
      cost: 90,
      allowFractional: true,
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 12,
        price: 1200,
        cost: 1080,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Sugar 1kg",
    sku: "SUG-001",
    category: "Groceries",
    cost: 150,
    price: 180,
    stock: 100,
    minStock: 25,
    baseUnit: {
      name: "Packet",
      abbreviation: "pkt",
      unitType: "WHOLE",
      price: 180,
      cost: 150,
      allowFractional: false,
      barcode: "8901234567890",
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 24,
        price: 3960,
        cost: 3600,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Pishori Rice",
    sku: "RICE-001",
    category: "Groceries",
    cost: 160,
    price: 200,
    stock: 100,
    minStock: 10,
    baseUnit: {
      name: "Kilogram",
      abbreviation: "kg",
      unitType: "MEASURED",
      price: 200,
      cost: 160,
      allowFractional: true,
    },
    units: [
      {
        name: "500g",
        abbreviation: "500g",
        unitType: "PACKAGED",
        conversionQty: 0.5,
        price: 120,
        cost: 80,
        allowFractional: false,
      },
      {
        name: "250g",
        abbreviation: "250g",
        unitType: "PACKAGED",
        conversionQty: 0.25,
        price: 65,
        cost: 40,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Pishori Rice 5kg",
    sku: "PRI-005",
    category: "Groceries",
    cost: 750,
    price: 950,
    stock: 35,
    minStock: 10,
    baseUnit: {
      name: "Bag",
      abbreviation: "bg",
      unitType: "WHOLE",
      price: 950,
      cost: 750,
      allowFractional: false,
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 12,
        price: 11000,
        cost: 9000,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Cooking Oil",
    sku: "CO-001",
    category: "Groceries",
    cost: 380,
    price: 250,
    stock: 100,
    minStock: 10,
    baseUnit: {
      name: "Liter",
      abbreviation: "L",
      unitType: "MEASURED",
      price: 250,
      cost: 380,
      allowFractional: true,
    },
    units: [
      {
        name: "5L Jerrican",
        abbreviation: "5L",
        unitType: "PACKAGED",
        conversionQty: 5,
        price: 1100,
        cost: 1900,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Cooking Oil 2L",
    sku: "OIL-002",
    category: "Groceries",
    cost: 700,
    price: 450,
    stock: 20,
    minStock: 10,
    baseUnit: {
      name: "Bottle",
      abbreviation: "btl",
      unitType: "WHOLE",
      price: 450,
      cost: 700,
      allowFractional: false,
    },
  },
  {
    name: "Cooking Oil 5L",
    sku: "OIL-005",
    category: "Groceries",
    cost: 850,
    price: 1100,
    stock: 10,
    minStock: 10,
    baseUnit: {
      name: "Jerrycan",
      abbreviation: "jry",
      unitType: "WHOLE",
      price: 1100,
      cost: 850,
      allowFractional: false,
    },
  },
  {
    name: "Eggs",
    sku: "EGG-001",
    category: "Groceries",
    cost: 20,
    price: 25,
    stock: 120,
    minStock: 30,
    baseUnit: {
      name: "Piece",
      abbreviation: "pc",
      unitType: "WHOLE",
      price: 25,
      cost: 20,
      allowFractional: false,
    },
    units: [
      {
        name: "Tray",
        abbreviation: "tray",
        unitType: "PACKAGED",
        conversionQty: 30,
        price: 700,
        cost: 600,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Fanta Orange 500ml",
    sku: "FAN-500",
    category: "Beverages",
    cost: 55,
    price: 70,
    stock: 30,
    minStock: 15,
    baseUnit: {
      name: "Bottle",
      abbreviation: "btl",
      unitType: "WHOLE",
      price: 70,
      cost: 55,
      allowFractional: false,
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 24,
        price: 1560,
        cost: 1320,
        allowFractional: false,
      },
    ],
  },
  {
    name: "Coca Cola 2L",
    sku: "CC-002",
    category: "Beverages",
    cost: 160,
    price: 200,
    stock: 15,
    minStock: 10,
    baseUnit: {
      name: "Bottle",
      abbreviation: "btl",
      unitType: "WHOLE",
      price: 200,
      cost: 160,
      allowFractional: false,
    },
  },
  {
    name: "Baking Flour 1kg",
    sku: "BFL-001",
    category: "Groceries",
    cost: 200,
    price: 250,
    stock: 20,
    minStock: 10,
    baseUnit: {
      name: "Packet",
      abbreviation: "pkt",
      unitType: "WHOLE",
      price: 250,
      cost: 200,
      allowFractional: false,
    },
  },
  {
    name: "Wheat Flour 2kg",
    sku: "WFL-002",
    category: "Groceries",
    cost: 300,
    price: 380,
    stock: 15,
    minStock: 12,
    baseUnit: {
      name: "Packet",
      abbreviation: "pkt",
      unitType: "WHOLE",
      price: 380,
      cost: 300,
      allowFractional: false,
    },
  },
  {
    name: "Butter 500g",
    sku: "BTR-500",
    category: "Dairy",
    cost: 320,
    price: 420,
    stock: 15,
    minStock: 10,
    baseUnit: {
      name: "Block",
      abbreviation: "blk",
      unitType: "WHOLE",
      price: 420,
      cost: 320,
      allowFractional: false,
    },
  },
  {
    name: "Cheese Slices 200g",
    sku: "CHS-200",
    category: "Dairy",
    cost: 270,
    price: 350,
    stock: 20,
    minStock: 8,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 350,
      cost: 270,
      allowFractional: false,
    },
  },
  {
    name: "Fresh Milk 500ml",
    sku: "MLK-500",
    category: "Dairy",
    cost: 50,
    price: 65,
    stock: 50,
    minStock: 15,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 65,
      cost: 50,
      allowFractional: false,
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 12,
        price: 720,
        cost: 600,
        allowFractional: false,
      },
    ],
  },
  {
    name: "White Bread",
    sku: "BRD-001",
    category: "Bakery",
    cost: 60,
    price: 80,
    stock: 20,
    minStock: 20,
    baseUnit: {
      name: "Loaf",
      abbreviation: "lf",
      unitType: "WHOLE",
      price: 80,
      cost: 60,
      allowFractional: false,
    },
  },
  {
    name: "Fine Salt 1kg",
    sku: "SLT-001",
    category: "Groceries",
    cost: 90,
    price: 120,
    stock: 35,
    minStock: 15,
    baseUnit: {
      name: "Packet",
      abbreviation: "pkt",
      unitType: "WHOLE",
      price: 120,
      cost: 90,
      allowFractional: false,
    },
  },
  {
    name: "Frozen Chicken 1kg",
    sku: "CHK-001",
    category: "Frozen",
    cost: 650,
    price: 850,
    stock: 10,
    minStock: 15,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 850,
      cost: 650,
      allowFractional: false,
    },
  },
  {
    name: "Ground Coffee 250g",
    sku: "COF-250",
    category: "Groceries",
    cost: 350,
    price: 450,
    stock: 40,
    minStock: 8,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 450,
      cost: 350,
      allowFractional: false,
    },
  },
  {
    name: "Apple Juice 1L",
    sku: "APJ-001",
    category: "Beverages",
    cost: 190,
    price: 250,
    stock: 0,
    minStock: 12,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 250,
      cost: 190,
      allowFractional: false,
    },
  },
  {
    name: "Tea Bags 100ct",
    sku: "TEA-100",
    category: "Groceries",
    cost: 240,
    price: 320,
    stock: 55,
    minStock: 20,
    baseUnit: {
      name: "Box",
      abbreviation: "bx",
      unitType: "WHOLE",
      price: 320,
      cost: 240,
      allowFractional: false,
    },
  },
  {
    name: "Spaghetti 500g",
    sku: "PST-500",
    category: "Groceries",
    cost: 110,
    price: 150,
    stock: 25,
    minStock: 10,
    baseUnit: {
      name: "Pack",
      abbreviation: "pk",
      unitType: "WHOLE",
      price: 150,
      cost: 110,
      allowFractional: false,
    },
  },
  {
    name: "Tomato Ketchup 1kg",
    sku: "KTC-001",
    category: "Groceries",
    cost: 210,
    price: 280,
    stock: 0,
    minStock: 10,
    baseUnit: {
      name: "Bottle",
      abbreviation: "btl",
      unitType: "WHOLE",
      price: 280,
      cost: 210,
      allowFractional: false,
    },
  },
  {
    name: "Soya Sauce 250ml",
    sku: "SOY-250",
    category: "Groceries",
    cost: 130,
    price: 180,
    stock: 15,
    minStock: 8,
    baseUnit: {
      name: "Bottle",
      abbreviation: "btl",
      unitType: "WHOLE",
      price: 180,
      cost: 130,
      allowFractional: false,
    },
  },
  {
    name: "Oats 1kg",
    sku: "OAT-001",
    category: "Groceries",
    cost: 220,
    price: 300,
    stock: 20,
    minStock: 10,
    baseUnit: {
      name: "Packet",
      abbreviation: "pkt",
      unitType: "WHOLE",
      price: 300,
      cost: 220,
      allowFractional: false,
    },
  },
  {
    name: "Yogurt 200ml",
    sku: "YOG-200",
    category: "Dairy",
    cost: 65,
    price: 90,
    stock: 35,
    minStock: 20,
    baseUnit: {
      name: "Cup",
      abbreviation: "cp",
      unitType: "WHOLE",
      price: 90,
      cost: 65,
      allowFractional: false,
    },
    units: [
      {
        name: "Carton",
        abbreviation: "ctn",
        unitType: "PACKAGED",
        conversionQty: 12,
        price: 960,
        cost: 780,
        allowFractional: false,
      },
    ],
  },
];

// ============================================================
// SEED FUNCTION — UPDATE instead of skip
// ============================================================

async function main() {
  console.log('🌱 Seeding/Updating KxTill products with costs...');

  const org = await prisma.organization.findFirst({
    where: { owner: { email: 'vinnykylex@gmail.com' } },
  });

  if (!org) {
    console.error('❌ Organization not found.');
    process.exit(1);
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId: org.id, isActive: true },
  });

  console.log(`📦 Found ${branches.length} branches`);

  let updated = 0;
  let created = 0;

  for (const data of productData) {
    // Find existing product
    const existing = await prisma.kxTillProduct.findFirst({
      where: {
        organizationId: org.id,
        sku: data.sku,
      },
    });

    let product;

    if (existing) {
      // ✅ UPDATE existing product with cost
      product = await prisma.kxTillProduct.update({
        where: { id: existing.id },
        data: {
          cost: data.cost,
          name: data.name,
          category: data.category,
        },
      });
      
      // ✅ Update base unit cost
      const baseUnit = await prisma.kxTillProductUnit.findFirst({
        where: {
          productId: product.id,
          isBaseUnit: true,
        },
      });
      
      if (baseUnit) {
        await prisma.kxTillProductUnit.update({
          where: { id: baseUnit.id },
          data: {
            price: data.baseUnit.price,
            cost: data.baseUnit.cost || data.cost,
            name: data.baseUnit.name,
            abbreviation: data.baseUnit.abbreviation,
            allowFractional: data.baseUnit.allowFractional || false,
          },
        });
      }

      // ✅ Update additional units
      if (data.units) {
        for (const unitData of data.units) {
          const existingUnit = await prisma.kxTillProductUnit.findFirst({
            where: {
              productId: product.id,
              name: unitData.name,
              isBaseUnit: false,
            },
          });

          if (existingUnit) {
            await prisma.kxTillProductUnit.update({
              where: { id: existingUnit.id },
              data: {
                price: unitData.price,
                cost: unitData.cost || unitData.conversionQty * data.cost,
                conversionQty: unitData.conversionQty,
                allowFractional: unitData.allowFractional || false,
              },
            });
          } else {
            await prisma.kxTillProductUnit.create({
              data: {
                productId: product.id,
                name: unitData.name,
                abbreviation: unitData.abbreviation,
                unitType: unitData.unitType || 'PACKAGED',
                conversionQty: unitData.conversionQty,
                price: unitData.price,
                cost: unitData.cost || unitData.conversionQty * data.cost,
                allowFractional: unitData.allowFractional || false,
                isBaseUnit: false,
              },
            });
          }
        }
      }

      updated++;
      console.log(`✅ UPDATED: ${data.sku} - cost: ${data.cost}`);
    } else {
      // Create new product (existing logic)
      product = await prisma.kxTillProduct.create({
        data: {
          organizationId: org.id,
          name: data.name,
          sku: data.sku,
          category: data.category,
          cost: data.cost,
          taxRate: 0,
          trackInventory: true,
        },
      });

      const baseUnit = await prisma.kxTillProductUnit.create({
        data: {
          productId: product.id,
          name: data.baseUnit.name,
          abbreviation: data.baseUnit.abbreviation,
          unitType: data.baseUnit.unitType || 'WHOLE',
          conversionQty: 1,
          price: data.baseUnit.price,
          cost: data.baseUnit.cost || data.cost,
          allowFractional: data.baseUnit.allowFractional || false,
          barcode: data.baseUnit.barcode || null,
          isBaseUnit: true,
        },
      });

      await prisma.kxTillProduct.update({
        where: { id: product.id },
        data: { baseUnitId: baseUnit.id },
      });

      if (data.units) {
        for (const unitData of data.units) {
          await prisma.kxTillProductUnit.create({
            data: {
              productId: product.id,
              name: unitData.name,
              abbreviation: unitData.abbreviation,
              unitType: unitData.unitType || 'PACKAGED',
              conversionQty: unitData.conversionQty,
              price: unitData.price,
              cost: unitData.cost || unitData.conversionQty * data.cost,
              allowFractional: unitData.allowFractional || false,
              isBaseUnit: false,
            },
          });
        }
      }

      // Create branch products
      for (const branch of branches) {
        await prisma.kxTillBranchProduct.create({
          data: {
            productId: product.id,
            branchId: branch.id,
            displayName: data.name,
            stock: data.stock || 0,
            minStock: data.minStock || 0,
            isAvailable: true,
          },
        });
      }

      created++;
      console.log(`✅ CREATED: ${data.sku} - cost: ${data.cost}`);
    }
  }

  console.log(`✅ Done: ${updated} updated, ${created} created.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });