// src/modules/platform/audit/jobs/auditSweep.job.js

import cron from 'node-cron';
import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// AUDIT LOG SWEEP
// ============================================================
// Deletes audit events older than each organization's configured
// retention window (auditLogRetention on Organization).
//
// Runs daily at 03:00 Africa/Nairobi.
//
// Retention is per-org. We loop over active orgs and issue a
// scoped DELETE per org so each respects its own window.

const CRON_EXPRESSION = '0 3 * * *';       // 03:00 daily
const CRON_TIMEZONE = 'Africa/Nairobi';

let task = null;

const sweepOrganization = async (orgId, retentionDays) => {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.auditEvent.deleteMany({
    where: {
      organizationId: orgId,
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
};

const runSweep = async () => {
  const startedAt = new Date();
  console.log(`[auditSweep] started at ${startedAt.toISOString()}`);

  let totalDeleted = 0;
  let orgsProcessed = 0;
  let orgsFailed = 0;

  try {
    const orgs = await prisma.organization.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, auditLogRetention: true },
    });

    for (const org of orgs) {
      try {
        const deleted = await sweepOrganization(org.id, org.auditLogRetention);
        totalDeleted += deleted;
        orgsProcessed += 1;

        if (deleted > 0) {
          console.log(
            `[auditSweep] ${org.name} (${org.id}): deleted ${deleted} events older than ${org.auditLogRetention}d`
          );
        }
      } catch (err) {
        orgsFailed += 1;
        console.error(`[auditSweep] failed for org ${org.id}:`, err);
      }
    }

    console.log(
      `[auditSweep] done in ${Date.now() - startedAt.getTime()}ms · ` +
        `orgs=${orgsProcessed} failed=${orgsFailed} deleted=${totalDeleted}`
    );
  } catch (err) {
    console.error('[auditSweep] fatal:', err);
  }
};

export const startAuditSweep = () => {
  if (task) return task;

  task = cron.schedule(CRON_EXPRESSION, runSweep, {
    timezone: CRON_TIMEZONE,
  });

  console.log(
    `[auditSweep] scheduled — cron="${CRON_EXPRESSION}" tz="${CRON_TIMEZONE}"`
  );

  return task;
};

// Expose for manual trigger / testing.
export const runAuditSweepNow = runSweep;