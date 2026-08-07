// src/database/postgres/prisma/seed.js

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: '5595',
  host: 'localhost',
  port: 5432,
  database: 'kxbyte',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const products = [
  {
    key: 'kxtill',
    name: 'KxTill',
    version: '1.0.0',
    description: 'Point of Sale and Inventory Management',
    icon: null,  
  },
];

async function main() {
  console.log('🌱 Seeding products...');

  for (const product of products) {
    await prisma.product.upsert({
      where: { key: product.key },
      update: {
        name: product.name,
        version: product.version,
        description: product.description,
        icon: product.icon,  // ← changed from logoUrl
      },
      create: product,
    });
    console.log(`✅ ${product.name} (v${product.version}) seeded`);
  }

  console.log('✅ Products seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });