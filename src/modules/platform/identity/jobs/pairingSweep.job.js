// src/modules/platform/identity/jobs/pairingSweep.job.js
//
// Deletes expired pairing_sessions rows once an hour. Expired tokens are
// already rejected at redeem time, so this is housekeeping — it keeps the
// table from accumulating abandoned sessions (frozen POS machines, closed
// tabs, users who did not scan).

import pairingService from '../services/pairing.service.js';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let timer = null;
let running = false;

async function runSweep() {
  if (running) return; // never overlap
  running = true;
  try {
    const { removed } = await pairingService.sweepExpired();
    if (removed > 0) {
      console.log(`[pairingSweep] removed ${removed} expired pairing session(s)`);
    }
  } catch (e) {
    console.error('[pairingSweep] failed:', e.message);
  } finally {
    running = false;
  }
}

export function startPairingSweep() {
  if (timer) return;
  // Run once shortly after boot, then hourly.
  setTimeout(runSweep, 30 * 1000);
  timer = setInterval(runSweep, INTERVAL_MS);
  console.log(`[pairingSweep] scheduled — interval=${INTERVAL_MS / 1000}s`);
}

export function stopPairingSweep() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export default { startPairingSweep, stopPairingSweep };