// scripts/test-trial-burn.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import productService from '../src/modules/platform/products/services/product.service.js';

async function main() {
  // Use an existing org that's NOT your main test org.
  // Pick one, or create a fresh one below.
  const org = await prisma.organization.findFirst({
    where: {
      slug: 'test-org',  // ← change if needed
      isInternal: false,
    },
    include: { owner: true },
  });

  if (!org) {
    console.error('No test org found');
    process.exit(1);
  }

  console.log(`[test] org: ${org.name} owner: ${org.owner.email}`);

  // ---------- Reset state so we can replay ----------
  await prisma.payment.deleteMany({
    where: { subscription: { organizationId: org.id } },
  });
  await prisma.subscription.deleteMany({
    where: { organizationId: org.id },
  });
  const kxtill = await prisma.product.findUnique({ where: { key: 'kxtill' } });
  await prisma.organizationProduct.deleteMany({
    where: { organizationId: org.id, productId: kxtill.id },
  });
  await prisma.trialBurn.deleteMany({
    where: { ownerUserId: org.ownerId, productKey: 'kxtill' },
  });
  console.log('[test] reset — no sub, no product, no burn');

  // ---------- Scenario 1: first activation ----------
  console.log('\n=== SCENARIO 1: first activation (should get TRIAL) ===');
  await productService.activateProduct(org.id, org.ownerId, 'kxtill');

  let sub = await prisma.subscription.findUnique({
    where: { organizationId_productKey: { organizationId: org.id, productKey: 'kxtill' } },
  });
  console.log(`  status: ${sub.status}`);
  console.log(`  trialEnd: ${sub.trialEnd}`);

  const burn = await prisma.trialBurn.findUnique({
    where: { ownerUserId_productKey: { ownerUserId: org.ownerId, productKey: 'kxtill' } },
  });
  console.log(`  trial burned: ${!!burn}`);

  // ---------- Scenario 2: deactivate + reactivate ----------
  console.log('\n=== SCENARIO 2: deactivate then reactivate (should get NO trial) ===');
  await productService.deactivateProduct(org.id, org.ownerId, 'kxtill');
  console.log('  deactivated');

  await productService.activateProduct(org.id, org.ownerId, 'kxtill');

  sub = await prisma.subscription.findUnique({
    where: { organizationId_productKey: { organizationId: org.id, productKey: 'kxtill' } },
  });
  console.log(`  status: ${sub.status}`);
  console.log(`  trialEnd: ${sub.trialEnd}`);
  console.log(`  expiredAt: ${sub.expiredAt}`);

  if (sub.status === 'EXPIRED' && !sub.trialEnd) {
    console.log('\n✅ PASS — second activation has no trial');
  } else {
    console.log('\n❌ FAIL — second activation still has trial');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });