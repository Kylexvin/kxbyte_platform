// src/modules/products/admin/onboarding/jobs/onboardingSweep.job.js
//
// Periodic auto-check sync. Runs every 10 minutes, resolves any pending
// auto-check tasks whose underlying product state now satisfies the check.
//
// Failures inside a single onboarding are logged and skipped — the sweep
// never crashes the process.

import cron from 'node-cron';
import onboardingService from '../services/onboarding.service.js';

let task = null;

export const startOnboardingSweep = () => {
  if (task) return; // idempotent

  task = cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await onboardingService.syncAllActive();
      if (result.tasksUpdated > 0) {
        console.log(
          `[onboardingSweep] synced ${result.onboardingsSynced} onboardings, ${result.tasksUpdated} tasks`
        );
      }
    } catch (err) {
      console.error('[onboardingSweep] failed:', err.message);
    }
  });

  console.log('[onboardingSweep] scheduled — interval=10m');
};