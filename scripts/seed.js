// scripts/seed.js
import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/database/postgres/prisma.js';

const SALT_ROUNDS = 10;

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@kxbyte.co.ke';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
const ADMIN_FIRST_NAME = process.env.SEED_ADMIN_FIRST_NAME || 'KxByte';
const ADMIN_LAST_NAME = process.env.SEED_ADMIN_LAST_NAME || 'Admin';

const KXBYTE_SLUG = 'kxbyte';
const KXBYTE_NAME = 'KxByte';
const PLATFORM_ADMIN_ROLE = 'platform_admin';

export async function runSeed() {
  console.log('[seed] starting');

  // ============================================================
  // 1. Admin user
  // ============================================================
  let adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!adminUser) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    adminUser = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: passwordHash,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        isEmailVerified: true,
        isActive: true,
      },
    });
    console.log('[seed] admin user created:', adminUser.id);
  } else {
    console.log('[seed] admin user exists:', adminUser.id);
  }

  // ============================================================
  // 2. KxByte internal org
  // ============================================================
  const kxbyte = await prisma.organization.upsert({
    where: { slug: KXBYTE_SLUG },
    update: { isInternal: true, isActive: true },
    create: {
      name: KXBYTE_NAME,
      slug: KXBYTE_SLUG,
      ownerId: adminUser.id,
      country: 'KE',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
      isInternal: true,
      isActive: true,
    },
  });
  console.log('[seed] kxbyte org:', kxbyte.id);

  // ============================================================
  // 3. platform_admin role on kxbyte org
  // ============================================================
  const role = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: kxbyte.id, name: PLATFORM_ADMIN_ROLE } },
    update: { isSystem: true },
    create: {
      organizationId: kxbyte.id,
      name: PLATFORM_ADMIN_ROLE,
      description: 'KxByte platform administrator — full admin product access',
      isSystem: true,
    },
  });
  console.log('[seed] role:', role.id);

  // ============================================================
  // 4. Attach admin user to kxbyte org
  // ============================================================
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: adminUser.id, organizationId: kxbyte.id } },
    update: { roleId: role.id, isActive: true },
    create: {
      userId: adminUser.id,
      organizationId: kxbyte.id,
      roleId: role.id,
      isActive: true,
      hasAllBranches: true,
    },
  });
  console.log('[seed] membership attached');

  // ============================================================
  // 5. Grant every admin.* permission to platform_admin
  //    (permissions are registered by initializeProducts() at boot)
  // ============================================================
  const adminPerms = await prisma.permission.findMany({
    where: { productKey: 'admin', isActive: true },
  });

  let granted = 0;
  for (const p of adminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {},
      create: { roleId: role.id, permissionId: p.id },
    });
    granted++;
  }
  console.log(`[seed] granted ${granted} admin permissions`);

  // ============================================================
  // 6. Upsert product rows (admin, kxtill)
  // ============================================================
  const products = [
    { key: 'admin', name: 'KxByte Admin', version: '1.0.0', description: 'KxByte internal platform administration' },
    { key: 'kxtill', name: 'KxTill', version: '1.0.0', description: 'Point of sale and retail management' },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { key: p.key },
      update: { name: p.name, description: p.description, isActive: true },
      create: { ...p, isActive: true },
    });
  }
  console.log('[seed] products upserted:', products.map((p) => p.key).join(', '));

  console.log('[seed] done');
  return { adminUser, kxbyte, role };
}

// Allow `node scripts/seed.js` to run it standalone
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .catch((e) => { console.error('[seed] failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}