// scripts/test-onboarding-seed.js
//
// Seeds onboarding for a target org (default: KxNet) and prints the result.
// Also lists all tasks with their auto-check state and current status.
//
// Usage:
//   node scripts/test-onboarding-seed.js
//   node scripts/test-onboarding-seed.js --slug my-org
//   node scripts/test-onboarding-seed.js --org <uuid>
//   node scripts/test-onboarding-seed.js --cleanup

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import onboardingService from '../src/modules/products/admin/onboarding/services/onboarding.service.js';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const SLUG = getArg('--slug') || 'kxnet';
const ORG_ID = getArg('--org');
const CLEANUP = args.includes('--cleanup');
const PRODUCT_KEY = getArg('--product') || 'kxtill';

const main = async () => {
  // 1. Resolve org
  let org;
  if (ORG_ID) {
    org = await prisma.organization.findUnique({
      where: { id: ORG_ID },
      select: { id: true, name: true, slug: true },
    });
  } else {
    org = await prisma.organization.findUnique({
      where: { slug: SLUG },
      select: { id: true, name: true, slug: true },
    });
  }
  if (!org) throw new Error(`Org not found (slug=${SLUG}, id=${ORG_ID})`);
  console.log(`\nOrg: ${org.name} (${org.slug}) — ${org.id}`);

  // 2. Cleanup mode
  if (CLEANUP) {
    const existing = await prisma.organizationOnboarding.findUnique({
      where: {
        organizationId_productKey: { organizationId: org.id, productKey: PRODUCT_KEY },
      },
      select: { id: true },
    });
    if (!existing) {
      console.log('No onboarding to clean up.');
      return;
    }
    await prisma.onboardingTask.deleteMany({ where: { onboardingId: existing.id } });
    await prisma.organizationOnboarding.delete({ where: { id: existing.id } });
    console.log(`✓ Cleaned up onboarding ${existing.id}`);
    return;
  }

  // 3. Seed
  console.log(`\nSeeding ${PRODUCT_KEY} onboarding...`);
  const result = await onboardingService.seedForProduct(org.id, PRODUCT_KEY);

  if (!result) {
    console.log('⚠ No template registered for this product. Nothing seeded.');
    return;
  }
  if (result.id) {
    console.log(`✓ Onboarding: ${result.id}`);
  } else {
    console.log(`ℹ Already exists, skipping:`, result);
    return;
  }

  // 4. Inspect tasks
  const tasks = await prisma.onboardingTask.findMany({
    where: { onboardingId: result.id },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });

  console.log(`\nTasks seeded: ${tasks.length}`);
  const byCategory = tasks.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});
  console.log('  by category:', byCategory);

  console.log('\nAll tasks:');
  console.table(
    tasks.map((t) => ({
      key: t.key,
      category: t.category,
      source: t.source,
      autoCheck: t.autoCheck || '—',
      required: t.required,
      status: t.status,
      dueAt: t.dueAt ? t.dueAt.toISOString().slice(0, 10) : '—',
    }))
  );

  // 5. Trigger a lazy sync to resolve any auto-checks that already pass
  console.log('\nRunning auto-check sync...');
  const { updated } = await onboardingService.syncAutoChecksForOnboarding(result.id);
  console.log(`✓ ${updated} task(s) auto-completed`);

  // 6. Re-read after sync
  if (updated > 0) {
    const after = await prisma.onboardingTask.findMany({
      where: { onboardingId: result.id, status: 'COMPLETED' },
      select: { key: true, autoCheck: true },
    });
    console.log('\nCompleted by auto-check:');
    after.forEach((t) => console.log(`  ✓ ${t.key} (${t.autoCheck})`));
  }

  // 7. Print list result for this onboarding
  const list = await onboardingService.listOnboardings({ limit: 100 });
  const row = list.data.find((r) => r.id === result.id);
  if (row) {
    console.log('\nBoard row:');
    console.log(`  progress: ${row.progress.progressPercent}% (${row.progress.completedCount}/${row.progress.applicableCount} required)`);
    console.log(`  next: ${row.nextTask ? row.nextTask.title : 'none'}`);
    console.log(`  overdue: ${row.progress.overdueCount}, ignored: ${row.progress.ignoredCount}`);
  }
};

main()
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());