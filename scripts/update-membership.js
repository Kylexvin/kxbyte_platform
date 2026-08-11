// scripts/update-membership.js

import prisma from '../src/database/postgres/prisma.js';

async function main() {
  // Find Kamau's membership
  const membership = await prisma.membership.findFirst({
    where: {
      userId: '574abff2-410b-482f-871e-9535c6db9b8e',
      organizationId: 'c3d652ba-5a0e-4e94-a4d0-e4337b1ce8c4',
    },
  });

  if (!membership) {
    console.log('❌ Membership not found');
    return;
  }

  console.log('📋 Current membership:', membership);

  // Update hasAllBranches to true
  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { hasAllBranches: true },
  });

  console.log('✅ Updated membership:', updated);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());