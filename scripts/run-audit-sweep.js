// scripts/run-audit-sweep.js

import 'dotenv/config';
import { runAuditSweepNow } from '../src/modules/platform/audit/jobs/auditSweep.job.js';
import prisma from '../src/database/postgres/prisma.js';

try {
  await runAuditSweepNow();
} finally {
  await prisma.$disconnect();
}