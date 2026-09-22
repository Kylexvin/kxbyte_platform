// scripts/clean-test-payment.js
import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const result = await prisma.payment.deleteMany({
  where: { reference: 'TEST-NOTIFY-001' },
});
console.log(`deleted ${result.count} test payment(s)`);

await prisma.$disconnect();