// src/modules/platform/support/seed/categories.seed.js

import categoryDb from '../db/category.db.js';

// ============================================================
// DEFAULT SUPPORT CATEGORIES
// ============================================================
// Seeded once per boot. Upsert by slug so edits to the names or
// descriptions here propagate on the next restart.

const DEFAULT_CATEGORIES = [
  {
    name: 'Bug Report',
    slug: 'bug-report',
    description: 'Something is broken or behaving unexpectedly',
  },
  {
    name: 'How-To',
    slug: 'how-to',
    description: 'Questions on how to use a feature',
  },
  {
    name: 'Billing',
    slug: 'billing',
    description: 'Subscription, payments, and invoices',
  },
  {
    name: 'Feature Request',
    slug: 'feature-request',
    description: 'Suggestions for new functionality',
  },
  {
    name: 'Other',
    slug: 'other',
    description: 'Anything that does not fit the categories above',
  },
];

export const seedSupportCategories = async () => {
  for (const cat of DEFAULT_CATEGORIES) {
    await categoryDb.upsertCategoryByName(cat);
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} support categories`);
};