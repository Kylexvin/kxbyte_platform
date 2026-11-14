// src/modules/platform/subscriptions/services/billing-config.service.js
//
// Platform-wide billing configuration. Singleton row in `billing_config`.
// Replaces hardcoded PAYMENT object previously in kxtill/services/billing.service.js.
//
// Consumers (kxtill billing, future products) read via getConfig().
// Admin edits via updateConfig() — audited.
//
// Cache: 60s in-process. Invalidated on updateConfig.

import prisma from '../../../../database/postgres/prisma.js';
import audit from '../../audit/index.js';
import {
  ValidationError,
  NotFoundError,
} from '../../../products/kxcrm/domain/errors.js';

const SINGLETON_ID = 'singleton';
const CACHE_TTL_MS = 60_000;

let cache = null; // { config, ts }

// ============================================================
// READ
// ============================================================

const getConfig = async () => {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return cache.config;
  }

  let row = await prisma.billingConfig.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (!row) {
    // Auto-create on first read. Should be seeded on boot, but this is defensive.
    row = await prisma.billingConfig.create({
      data: {
        id: SINGLETON_ID,
        mpesaPhone: '0768610613',
        bankName: 'I&M Bank',
        bankAccount: '00108456156150',
        bankAccountName: 'VINCENT KIPCHIRCHIR',
        contactEmail: 'admin@kxbyte.co.ke',
        contactPhone: '+254768610613',
        accountPrefix: 'KXBYTE-',
        graceDays: 2,
        trialDays: 21,
      },
    });
    console.log('[billing-config] auto-created singleton row');
  }

  cache = { config: row, ts: now };
  return row;
};

// ============================================================
// UPDATE
// ============================================================

const VALIDATORS = {
  graceDays: (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 14) {
      throw new ValidationError(
        'INVALID_GRACE_DAYS',
        'Grace days must be an integer between 0 and 14'
      );
    }
    return n;
  },
  trialDays: (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 90) {
      throw new ValidationError(
        'INVALID_TRIAL_DAYS',
        'Trial days must be an integer between 1 and 90'
      );
    }
    return n;
  },
  accountPrefix: (v) => {
    if (typeof v !== 'string' || !v.trim() || v.length > 40) {
      throw new ValidationError(
        'INVALID_ACCOUNT_PREFIX',
        'Account prefix must be 1-40 characters, no leading/trailing spaces'
      );
    }
    return v.trim();
  },
};

const STRING_FIELDS = [
  'paybill',
  'tillNumber',
  'mpesaPhone',
  'bankName',
  'bankAccount',
  'bankAccountName',
  'contactEmail',
  'contactPhone',
];

const updateConfig = async (userId, patch) => {
  const before = await getConfig();

  const update = {};
  for (const field of STRING_FIELDS) {
    if (patch[field] !== undefined) {
      update[field] =
        typeof patch[field] === 'string' && patch[field].trim()
          ? patch[field].trim()
          : null;
    }
  }
  for (const [field, validate] of Object.entries(VALIDATORS)) {
    if (patch[field] !== undefined) {
      update[field] = validate(patch[field]);
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('NOTHING_TO_UPDATE', 'No valid fields to update');
  }

  update.updatedById = userId;

  const updated = await prisma.billingConfig.update({
    where: { id: SINGLETON_ID },
    data: update,
  });

  await audit.log({
    organizationId: null,
    userId,
    action: 'BILLING_CONFIG_UPDATED',
    resource: 'billing_config',
    resourceId: SINGLETON_ID,
    metadata: {
      updatedFields: Object.keys(update).filter((k) => k !== 'updatedById'),
      before: Object.fromEntries(
        Object.keys(update)
          .filter((k) => k !== 'updatedById')
          .map((k) => [k, before[k]])
      ),
      after: Object.fromEntries(
        Object.keys(update)
          .filter((k) => k !== 'updatedById')
          .map((k) => [k, updated[k]])
      ),
    },
  });

  // Invalidate cache
  cache = null;

  return updated;
};

// ============================================================
// CACHE CONTROL (for explicit invalidation, e.g. from tests)
// ============================================================

const invalidateCache = () => {
  cache = null;
};

export default {
  getConfig,
  updateConfig,
  invalidateCache,
};