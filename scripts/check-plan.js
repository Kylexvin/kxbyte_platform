// scripts/check-plan.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const plans = await prisma.plan.findMany({ where: { productKey: 'kxtill' } });
console.log(plans.map((p) => ({
  key: p.key,
  trialDays: p.trialDays,
  isActive: p.isActive,
  updatedAt: p.updatedAt,
})));

await prisma.$disconnect();