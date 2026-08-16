// prisma/seed-support-categories.js

import prisma from '../src/database/postgres/prisma.js';

const categories = [
  {
    name: 'General',
    description: 'General questions and issues',
    slug: 'general',
  },
  {
    name: 'KxTill',
    description: 'Issues with Point of Sale and Inventory',
    slug: 'kxtill',
  },
  {
    name: 'KxInvoice',
    description: 'Issues with Invoicing and Billing',
    slug: 'kxinvoice',
  },
  {
    name: 'KxCRM',
    description: 'Issues with Customer Relationship Management',
    slug: 'kxcrm',
  },
  {
    name: 'Billing',
    description: 'Subscription, payment, and billing issues',
    slug: 'billing',
  },
  {
    name: 'Account',
    description: 'Account access, login, and profile issues',
    slug: 'account',
  },
  {
    name: 'Technical',
    description: 'Technical issues, bugs, and errors',
    slug: 'technical',
  },
];

async function main() {
  console.log('🌱 Seeding support categories...');

  for (const category of categories) {
    await prisma.supportCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
      create: category,
    });
    console.log(`✅ ${category.name} seeded`);
  }

  console.log('✅ Support categories seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });