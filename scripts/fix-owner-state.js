// scripts/fix-owner-state.js

import prisma from '../src/database/postgres/prisma.js';

async function main() {
  console.log('🔧 Fixing owner state...');

  // Find all organizations and their owners
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      ownerId: true,
    },
  });

  for (const org of orgs) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: org.ownerId,
          organizationId: org.id,
        },
      },
    });

    if (!membership) {
      console.log(`⚠️  No membership found for owner of ${org.name}`);
      continue;
    }

    const needsFix = membership.roleId !== null || !membership.hasAllBranches;

    if (needsFix) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          roleId: null,
          hasAllBranches: true,
        },
      });
      console.log(`✅ Fixed owner for ${org.name}`);
    } else {
      console.log(`✓  Owner of ${org.name} already correct`);
    }
  }

  console.log('✅ Done.');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());