// scripts/seed-billing-config.js
//
// One-time seed: creates the singleton BillingConfig row with the values
// currently hardcoded in kxtill/services/billing.service.js. Idempotent —
// does nothing if the row already exists.
//
// Run once after the migration. Also callable on boot for safety.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const DEFAULTS = {
  id: 'singleton',
  paybill: null,
  tillNumber: null,
  mpesaPhone: '0768610613',
  bankName: 'I&M Bank',
  bankAccount: '00108456156150',
  bankAccountName: 'VINCENT KIPCHIRCHIR',
  contactEmail: 'admin@kxbyte.co.ke',
  contactPhone: '+254768610613',
  accountPrefix: 'KXBYTE-',
  graceDays: 2,
  trialDays: 21,
};

const main = async () => {
  const existing = await prisma.billingConfig.findUnique({
    where: { id: 'singleton' },
    select: { id: true, updatedAt: true },
  });

  if (existing) {
    console.log('[seed] BillingConfig already exists — skipped.');
    console.log('[seed] updatedAt:', existing.updatedAt);
    return;
  }

  const created = await prisma.billingConfig.create({ data: DEFAULTS });
  console.log('[seed] BillingConfig created.');
  console.log('[seed] Fields:', Object.keys(DEFAULTS).filter((k) => k !== 'id'));
  console.log('[seed] graceDays:', created.graceDays, '· trialDays:', created.trialDays);
};

main()
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());