// scripts/seed-admin-roles.js
// Run: node scripts/seed-admin-roles.js
// Idempotent — safe to run multiple times.

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import roleDb from '../src/modules/platform/authorization/db/role.db.js';
import permissionDb from '../src/modules/platform/authorization/db/permission.db.js';

const KXBYTE_SLUG = 'kxbyte';

const ROLES = [
  {
    name: 'platform_admin',
    description: 'Full platform administration',
    permissions: ['*'],
  },
  {
    name: 'sales_agent',
    description: 'Leads, prospects and sales',
    permissions: [
      'admin.dashboard.view',
      'admin.organizations.view',
      'admin.subscriptions.view',
      'admin.payments.view',
    ],
  },
  {
    name: 'support_agent',
    description: 'Customer support',
    permissions: [
      'admin.dashboard.view',
      'admin.organizations.view',
      'support.tickets.view',
      'support.tickets.manage',
    ],
  },
  {
    name: 'onboarding_agent',
    description: 'Customer onboarding',
    permissions: [
      'admin.dashboard.view',
      'admin.organizations.view',
      'admin.organizations.manage',
    ],
  },
  {
    name: 'billing_agent',
    description: 'Payments and subscriptions',
    permissions: [
      'admin.dashboard.view',
      'admin.subscriptions.view',
      'admin.subscriptions.renew',
      'admin.payments.view',
      'admin.payments.record',
    ],
  },
  {
    name: 'read_only',
    description: 'View authorized information only',
    permissions: [
      'admin.dashboard.view',
      'admin.organizations.view',
      'admin.subscriptions.view',
      'admin.payments.view',
    ],
  },
];

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: KXBYTE_SLUG },
  });
  if (!org) {
    console.error(`Internal org "${KXBYTE_SLUG}" not found. Aborting.`);
    process.exit(1);
  }
  console.log(`Seeding roles for org: ${org.name} (${org.id})`);

  for (const def of ROLES) {
    let role = await roleDb.findRoleByOrgAndName(org.id, def.name);

    if (!role) {
      role = await roleDb.createRole({
        organizationId: org.id,
        name: def.name,
        description: def.description,
      });
      console.log(`  ✓ created role "${def.name}"`);
    } else {
      console.log(`  · role "${def.name}" already exists`);
    }

    // attach permissions
    for (const key of def.permissions) {
      const perm = await permissionDb.findPermissionByKey(key);
      if (!perm) {
        console.warn(`    ⚠ permission "${key}" not found in DB — skipping`);
        continue;
      }

      const existing = await roleDb.findRolePermissions(role.id);
      const has = existing.some((rp) => rp.permissionId === perm.id);
      if (has) continue;

      await roleDb.addPermissionToRole(role.id, perm.id);
      console.log(`    + ${key}`);
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());