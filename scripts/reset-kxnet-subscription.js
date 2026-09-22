// scripts/restore-kxnet.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const ORG_ID = 'e917d646-e4ee-40c7-a8d1-f3ad5d1fc990'; // KxNet
const RESTORE_PRODUCT = 'kxtill';
const REMOVE_PRODUCT = 'admin';

async function main() {
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error('Organization not found');
  console.log(`[fix] org: ${org.name} (${org.slug})`);

  // ---------- 1. Remove admin from this org ----------
  const admin = await prisma.product.findUnique({ where: { key: REMOVE_PRODUCT } });
  if (admin) {
    const removed = await prisma.organizationProduct.deleteMany({
      where: { organizationId: ORG_ID, productId: admin.id },
    });
    console.log(`[fix] removed admin: ${removed.count}`);

    const adminSub = await prisma.subscription.deleteMany({
      where: { organizationId: ORG_ID, productKey: REMOVE_PRODUCT },
    });
    if (adminSub.count) console.log(`[fix] removed admin subscription: ${adminSub.count}`);
  }

  // ---------- 2. Restore kxtill ----------
  const kxtill = await prisma.product.findUnique({ where: { key: RESTORE_PRODUCT } });
  if (!kxtill) throw new Error('kxtill product not found');

  const existingOp = await prisma.organizationProduct.findUnique({
    where: {
      organizationId_productId: {
        organizationId: ORG_ID,
        productId: kxtill.id,
      },
    },
  });

  if (existingOp) {
    if (!existingOp.isActive) {
      await prisma.organizationProduct.update({
        where: { id: existingOp.id },
        data: { isActive: true },
      });
      console.log('[fix] reactivated existing kxtill org-product');
    } else {
      console.log('[fix] kxtill org-product already active');
    }
  } else {
    await prisma.organizationProduct.create({
      data: {
        organizationId: ORG_ID,
        productId: kxtill.id,
        activatedAt: new Date(),
        isActive: true,
      },
    });
    console.log('[fix] created kxtill org-product');
  }

  const existingSub = await prisma.subscription.findUnique({
    where: {
      organizationId_productKey: {
        organizationId: ORG_ID,
        productKey: RESTORE_PRODUCT,
      },
    },
  });

  if (existingSub) {
    console.log(`[fix] kxtill subscription already exists (status=${existingSub.status})`);
  } else {
    const plan = await prisma.plan.findFirst({
      where: { productKey: RESTORE_PRODUCT, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!plan) throw new Error('No active kxtill plan found');

    const now = new Date();
    const trialEnd = new Date(now.getTime() + plan.trialDays * 86400000);
    const periodEnd = new Date(now.getTime() + (plan.interval === 'YEARLY' ? 365 : 30) * 86400000);

    await prisma.subscription.create({
      data: {
        organizationId: ORG_ID,
        productKey: RESTORE_PRODUCT,
        planId: plan.id,
        status: 'TRIAL',
        trialStart: now,
        trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    console.log(`[fix] created kxtill subscription (TRIAL, plan=${plan.key}, trialDays=${plan.trialDays})`);
  }

  // ---------- 3. Verify ----------
  const subs = await prisma.subscription.findMany({
    where: { organizationId: ORG_ID },
    select: { productKey: true, status: true },
  });
  const ops = await prisma.organizationProduct.findMany({
    where: { organizationId: ORG_ID },
    include: { product: { select: { key: true } } },
  });

  console.log('[fix] subscriptions:', subs);
  console.log('[fix] org-products:', ops.map((o) => o.product.key));
  console.log('[fix] done');
}

main()
  .catch((e) => { console.error('[fix] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());