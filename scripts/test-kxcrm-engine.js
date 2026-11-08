// scripts/test-kxcrm-engine.js
//
// Phase 2d smoke test for the KxCRM engine.
// Runs against the real DB. Creates its own orgs/users/stages/leads,
// asserts behaviour, tears down.
//
// Usage:
//   node scripts/test-kxcrm-engine.js            # run full test
//   CLEANUP_ONLY=1 node scripts/test-kxcrm-engine.js   # only delete leftovers

import 'dotenv/config';
import crypto from 'node:crypto';
import prisma from '../src/database/postgres/prisma.js';
import activityDb from '../src/modules/products/kxcrm/db/activity.db.js';
import pipelineService from '../src/modules/products/kxcrm/services/pipeline.service.js';
import leadsService from '../src/modules/products/kxcrm/services/leads.service.js';
import activitiesService from '../src/modules/products/kxcrm/services/activities.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../src/modules/products/kxcrm/domain/errors.js';

// ============================================================
// ASSERTIONS
// ============================================================

const results = [];
const record = (label, passed, detail = '') => {
  results.push({ label, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  const line = `[${mark}] ${label}${detail ? ` — ${detail}` : ''}`;
  passed ? console.log(line) : console.error(line);
};

const assertEqual = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(label, ok, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const assertThrows = async (label, fn, ExpectedErrorClass, expectedCode = null) => {
  try {
    await fn();
    record(label, false, `expected throw, got success`);
  } catch (err) {
    const classOk = err instanceof ExpectedErrorClass;
    const codeOk = expectedCode === null || err.code === expectedCode;
    const ok = classOk && codeOk;
    record(label, ok, ok ? '' : `expected ${ExpectedErrorClass.name}${expectedCode ? `/${expectedCode}` : ''}, got ${err.constructor.name}/${err.code ?? 'no-code'}: ${err.message}`);
  }
};

// ============================================================
// FIXTURES
// ============================================================

const runId = crypto.randomUUID().slice(0, 8);

const cleanup = async () => {
  const testOrgs = await prisma.organization.findMany({
    where: { slug: { startsWith: `kxcrm-test-${runId}` } },
    select: { id: true, ownerId: true },
  });
  const orgIds = testOrgs.map((o) => o.id);

  if (orgIds.length > 0) {
    await prisma.leadActivity.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.lead.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.pipelineStage.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }

  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: `kxcrm-test-${runId}-` } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log(`[cleanup] removed orgs=${orgIds.length} users=${userIds.length}`);
};

const makeUserWithRole = async ({ emailSuffix, rolePermissions, organizationId }) => {
  const email = `kxcrm-test-${runId}-${emailSuffix}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      password: 'test-not-a-real-hash',
      firstName: 'Test',
      lastName: emailSuffix,
      isEmailVerified: true,
      isActive: true,
    },
  });

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `test-role-${emailSuffix}-${runId}`,
      isSystem: false,
    },
  });

  const perms = await prisma.permission.findMany({
    where: { key: { in: rolePermissions } },
    select: { id: true },
  });

  if (perms.length !== rolePermissions.length) {
    throw new Error(
      `Permissions missing in DB. Expected ${rolePermissions.length}, found ${perms.length}. ` +
      `Make sure your permission injector ran and crm.* keys are seeded.`
    );
  }

  for (const p of perms) {
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: p.id },
    });
  }

  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId,
      roleId: role.id,
      isActive: true,
    },
  });

  return { user, role };
};

const makeOrg = async ({ suffix, ownerId }) => {
  return prisma.organization.create({
    data: {
      name: `KxCRM Test ${suffix}`,
      slug: `kxcrm-test-${runId}-${suffix}`,
      ownerId,
      country: 'KE',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
      isInternal: false,
      isActive: true,
    },
  });
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  if (process.env.CLEANUP_ONLY === '1') {
    await cleanup();
    return;
  }

  await cleanup();
  console.log(`\n=== kxcrm engine smoke test (run=${runId}) ===\n`);

  const bootstrapUser = await prisma.user.create({
    data: {
      email: `kxcrm-test-${runId}-bootstrap@example.test`,
      password: 'x',
      firstName: 'Boot',
      lastName: 'Strap',
      isEmailVerified: true,
    },
  });

  const orgA = await makeOrg({ suffix: 'a', ownerId: bootstrapUser.id });
  const orgB = await makeOrg({ suffix: 'b', ownerId: bootstrapUser.id });

  const ALL_CRM_PERMS = [
    'crm.pipeline.view', 'crm.pipeline.manage',
    'crm.leads.view', 'crm.leads.create', 'crm.leads.edit',
    'crm.leads.assign', 'crm.leads.change_stage', 'crm.leads.delete',
    'crm.leads.convert',
    'crm.activities.view', 'crm.activities.create',
  ];

  const { user: adminUser } = await makeUserWithRole({
    emailSuffix: 'admin',
    rolePermissions: ALL_CRM_PERMS,
    organizationId: orgA.id,
  });

  const adminRoleB = await prisma.role.create({
    data: { organizationId: orgB.id, name: `test-role-admin-b-${runId}`, isSystem: false },
  });
  const permsForB = await prisma.permission.findMany({ where: { key: { in: ALL_CRM_PERMS } }, select: { id: true } });
  for (const p of permsForB) {
    await prisma.rolePermission.create({ data: { roleId: adminRoleB.id, permissionId: p.id } });
  }
  await prisma.membership.create({
    data: { userId: adminUser.id, organizationId: orgB.id, roleId: adminRoleB.id, isActive: true },
  });

  const { user: noPermsUser } = await makeUserWithRole({
    emailSuffix: 'noperms',
    rolePermissions: [],
    organizationId: orgA.id,
  });

  const userId = adminUser.id;
  const A = orgA.id;
  const B = orgB.id;

  // ---- 1. ENGINE HAS NO PERMISSION GATE ----
  // Permissions are enforced by the admin routes, not the engine.
  const xStage = await pipelineService.createStage(noPermsUser.id, A, { name: 'X', key: 'x', order: 1 });
  record('engine has no permission gate (stage created directly)', !!xStage.id);
  await pipelineService.deleteStage(noPermsUser.id, A, xStage.id);

  // ---- 2. LIFECYCLE ----
  const sNew = await pipelineService.createStage(userId, A, { name: 'New', key: 'new', order: 1, color: '#0f0' });
  const sNeg = await pipelineService.createStage(userId, A, { name: 'Negotiation', key: 'negotiation', order: 2 });
  const sWon = await pipelineService.createStage(userId, A, { name: 'Won', key: 'won', order: 3, isWon: true });
  const sLost = await pipelineService.createStage(userId, A, { name: 'Lost', key: 'lost', order: 4, isLost: true });

  record('create 4 stages (New/Neg/Won/Lost)', !!(sNew.id && sNeg.id && sWon.id && sLost.id));

  const status = await pipelineService.getStatus(userId, A);
  assertEqual('getStatus isReady', status.isReady, true);
  assertEqual('getStatus wonStageId', status.wonStageId, sWon.id);
  assertEqual('getStatus lostStageId', status.lostStageId, sLost.id);

  const lead = await leadsService.createLead(userId, A, {
    businessName: 'Acme Test Ltd',
    contactName: 'Jane Doe',
    contactPhone: '+254712345678',
    source: 'WEBSITE',
    stageId: sNew.id,
  });
  record('create lead returns with relations', !!(lead.id && lead.stage?.id === sNew.id));
  assertEqual('create lead initial activity count', lead._count?.activities, 1);

  const moved1 = await leadsService.moveLeadToStage(userId, A, lead.id, sNeg.id);
  assertEqual('move to Negotiation', moved1.stageId, sNeg.id);

  await assertThrows(
    'moveLeadToStage to Won → USE_PROMOTE_ENDPOINT',
    () => leadsService.moveLeadToStage(userId, A, lead.id, sWon.id),
    ValidationError, 'USE_PROMOTE_ENDPOINT',
  );

  const moved2 = await leadsService.promoteLeadToWon(userId, A, lead.id);
  assertEqual('promoteLeadToWon succeeds', moved2.stageId, sWon.id);

  await assertThrows(
    'promoteLeadToWon when already Won → SAME_STAGE',
    () => leadsService.promoteLeadToWon(userId, A, lead.id),
    ValidationError, 'SAME_STAGE',
  );

  const actCall = await activitiesService.logActivity(userId, A, lead.id, {
    type: 'CALL',
    summary: 'Called about pricing',
    outcome: 'POSITIVE',
  });
  record('log CALL activity', !!actCall.id);

  const actVisit = await activitiesService.logActivity(userId, A, lead.id, {
    type: 'VISIT',
    summary: 'Onsite visit',
    visitObjections: 'Price too high',
    visitDemoRequested: true,
  });
  record('log VISIT activity', !!actVisit.id);

  const activities = await activitiesService.listForLead(userId, A, lead.id, {}, { limit: 100 });
  assertEqual('activity count for lead', activities.total, 5);

  const counted = await activitiesService.countForLead(userId, A, lead.id);
  assertEqual('countForLead matches list', counted.count, activities.total);

  // ---- 3. INVARIANTS ----
  await assertThrows(
    'second Won stage rejected',
    () => pipelineService.createStage(userId, A, { name: 'Won2', key: 'won2', order: 5, isWon: true }),
    ValidationError, 'WON_STAGE_EXISTS',
  );
  await assertThrows(
    'second Lost stage rejected',
    () => pipelineService.createStage(userId, A, { name: 'Lost2', key: 'lost2', order: 6, isLost: true }),
    ValidationError, 'LOST_STAGE_EXISTS',
  );
  await assertThrows(
    'delete Won stage with leads rejected',
    () => pipelineService.deleteStage(userId, A, sWon.id),
    ValidationError, 'STAGE_HAS_LEADS',
  );
  await assertThrows(
    'move to disabled stage rejected',
    async () => {
      await pipelineService.updateStage(userId, A, sNeg.id, { isActive: false });
      await leadsService.moveLeadToStage(userId, A, lead.id, sNeg.id);
    },
    ValidationError, 'CANT_MOVE_TO_DISABLED_STAGE',
  );
  await pipelineService.updateStage(userId, A, sNeg.id, { isActive: true });

  await assertThrows(
    'move to Lost without lostReason rejected',
    () => leadsService.moveLeadToStage(userId, A, lead.id, sLost.id, {}),
    ValidationError, 'LOST_REASON_REQUIRED',
  );
  const lostMove = await leadsService.moveLeadToStage(userId, A, lead.id, sLost.id, { lostReason: 'Budget cut' });
  assertEqual('move to Lost with reason sets lostAt', typeof lostMove.lostAt, 'object');
  assertEqual('move to Lost with reason sets lostReason', lostMove.lostReason, 'Budget cut');
  const reopened = await leadsService.moveLeadToStage(userId, A, lead.id, sNeg.id);
  assertEqual('move back out of Lost clears lostAt', reopened.lostAt, null);
  assertEqual('move back out of Lost clears lostReason', reopened.lostReason, null);

  // ---- 4. CONVERTED LEAD IS FROZEN ----
  const orgC = await makeOrg({ suffix: 'c', ownerId: bootstrapUser.id });
  // Lead is in Lost now → promote to Won before converting.
  await leadsService.promoteLeadToWon(userId, A, lead.id);
  const marked = await leadsService.markLeadAsConverted(A, userId, lead.id, orgC.id);
  assertEqual('markLeadAsConverted sets convertedOrganizationId', marked.convertedOrganizationId, orgC.id);

  await assertThrows(
    'update converted lead rejected',
    () => leadsService.updateLead(userId, A, lead.id, { notes: 'try me' }),
    ConflictError, 'LEAD_ALREADY_CONVERTED',
  );
  await assertThrows(
    'move converted lead rejected',
    () => leadsService.moveLeadToStage(userId, A, lead.id, sNeg.id),
    ConflictError, 'LEAD_ALREADY_CONVERTED',
  );
  await assertThrows(
    'delete converted lead rejected',
    () => leadsService.deleteLead(userId, A, lead.id),
    ConflictError, 'LEAD_ALREADY_CONVERTED',
  );

  // ---- 5. CROSS-ORG ISOLATION ----
  const sB = await pipelineService.createStage(userId, B, { name: 'New', key: 'new', order: 1 });
  await pipelineService.createStage(userId, B, { name: 'Won', key: 'won', order: 2, isWon: true });
  const leadB = await leadsService.createLead(userId, B, {
    businessName: 'Foreign Co', contactName: 'X', contactPhone: '+254700000000',
    source: 'OTHER', stageId: sB.id,
  });

  await assertThrows(
    'getLead(orgA, leadFromB) → NotFoundError',
    () => leadsService.getLead(userId, A, leadB.id),
    NotFoundError, 'LEAD_NOT_FOUND',
  );
  await assertThrows(
    'listForLead(orgA, leadFromB) → NotFoundError',
    () => activitiesService.listForLead(userId, A, leadB.id),
    NotFoundError, 'LEAD_NOT_FOUND',
  );
  await assertThrows(
    'moveLeadToStage(orgA, leadFromB, stageInA) → NotFoundError',
    () => leadsService.moveLeadToStage(userId, A, leadB.id, sNeg.id),
    NotFoundError, 'LEAD_NOT_FOUND',
  );
  await assertThrows(
    'createLead orgA with stageId from orgB → STAGE_NOT_IN_ORG',
    () => leadsService.createLead(userId, A, {
      businessName: 'Leak Co', contactName: 'Y', contactPhone: '+254700000001',
      source: 'OTHER', stageId: sB.id,
    }),
    ValidationError, 'STAGE_NOT_IN_ORG',
  );

  // ---- 6. SOFT DELETE ----
  const leadToDelete = await leadsService.createLead(userId, B, {
    businessName: 'Delete Me', contactName: 'Z', contactPhone: '+254700000002',
    source: 'OTHER', stageId: sB.id,
  });
  await leadsService.deleteLead(userId, B, leadToDelete.id);
  const afterDelete = await leadsService.getLead(userId, B, leadToDelete.id).catch((e) => e);
  record('soft-deleted lead returns NotFoundError', afterDelete instanceof NotFoundError);

  // ---- 7. TRANSACTION ATOMICITY ----
  const leadForTx = await leadsService.createLead(userId, A, {
    businessName: 'Tx Co', contactName: 'T', contactPhone: '+254700000003',
    source: 'OTHER', stageId: sNew.id,
  });

  const savedCreate = activityDb.create;
  activityDb.create = async () => { throw new Error('forced activity failure'); };

  try {
    await leadsService.moveLeadToStage(userId, A, leadForTx.id, sNeg.id);
    record('transaction rollback on activity failure', false, 'expected throw');
  } catch (err) {
    const reread = await prisma.lead.findUnique({ where: { id: leadForTx.id }, select: { stageId: true } });
    assertEqual('lead stageId unchanged after failed transaction', reread.stageId, sNew.id);
  } finally {
    activityDb.create = savedCreate;
  }

  // ---- cleanup ----
  await cleanup();

  const failures = results.filter((r) => !r.passed);
  console.log(`\n=== ${results.length - failures.length}/${results.length} passed ===\n`);
  if (failures.length > 0) {
    console.error('Failures:');
    failures.forEach((f) => console.error(`  - ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
    process.exit(1);
  }
};

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());