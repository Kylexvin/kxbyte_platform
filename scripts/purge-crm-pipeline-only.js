// scripts/purge-crm-pipeline-only.js
//
// Deletes ONLY CRM pipeline data for the kxbyte org.
// Does NOT touch organizations, users, memberships, roles, branches,
// permissions, or anything outside the CRM leads/activities/assignees.
//
// Usage:
//   node scripts/purge-crm-pipeline-only.js            # dry run
//   node scripts/purge-crm-pipeline-only.js --confirm  # actually delete

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const KXBYTE_SLUG = 'kxbyte';
const CONFIRM = process.argv.includes('--confirm');

const main = async () => {
  const kxbyte = await prisma.organization.findUnique({
    where: { slug: KXBYTE_SLUG },
    select: { id: true },
  });
  if (!kxbyte) throw new Error('kxbyte org not found');

  const leads = await prisma.lead.findMany({
    where: { organizationId: kxbyte.id },
    select: { id: true, businessName: true, stage: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nCRM leads in kxbyte: ${leads.length}`);
  leads.forEach((l) => console.log(`  - ${l.businessName} [${l.stage?.name ?? '—'}]`));

  if (!CONFIRM) {
    console.log('\nDRY RUN. Pass --confirm to delete these leads and their children.');
    console.log('Touches: Lead, LeadActivity, LeadAssignee.');
    console.log('Does NOT touch: Organizations, Users, Memberships, Roles, Branches, Permissions.');
    return;
  }

  const leadIds = leads.map((l) => l.id);

  const activities = await prisma.leadActivity.deleteMany({
    where: { leadId: { in: leadIds } },
  });
  console.log(`\n✓ Deleted ${activities.count} LeadActivity rows`);

  const assignees = await prisma.leadAssignee.deleteMany({
    where: { leadId: { in: leadIds } },
  });
  console.log(`✓ Deleted ${assignees.count} LeadAssignee rows`);

  const deleted = await prisma.lead.deleteMany({
    where: { id: { in: leadIds } },
  });
  console.log(`✓ Deleted ${deleted.count} Lead rows`);

  console.log('\nCRM pipeline cleared. Pipeline stages, orgs, users untouched.');
};

main()
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());