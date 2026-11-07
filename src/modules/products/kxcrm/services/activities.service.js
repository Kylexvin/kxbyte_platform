// src/modules/products/kxcrm/services/activities.service.js

import activityDb from '../db/activity.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import { assertActivityCreatePayload } from '../domain/activities/validation.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../domain/errors.js';

const assertPermission = async (userId, organizationId, key, message) => {
  const ok = await authorizationService.checkPermission(userId, organizationId, key);
  if (!ok) throw new ForbiddenError('FORBIDDEN', message);
};

// ============================================================
// SYSTEM ACTIVITY (engine-only, no user validation, no permission)
// ============================================================
//
// Written by moveLeadToStage, markLeadAsConverted, and future engine
// events. Payload is trusted engine code — no STAGE_CHANGE rejection,
// no user-input checks.

const logSystemActivity = async (
  organizationId,
  actorId,
  leadId,
  { type, summary, metadata = null },
  tx = undefined
) => {
  if (!type || !summary) {
    throw new ValidationError('SYSTEM_ACTIVITY_INVALID', 'type and summary are required for a system activity');
  }

  return activityDb.create(
    {
      organizationId,
      leadId,
      userId: actorId || null,
      type,
      summary,
      metadata,
    },
    tx
  );
};

export default {
  logSystemActivity,
  // logActivity, listActivities, deleteActivity, countForLead — Phase 2c (activities file)
};