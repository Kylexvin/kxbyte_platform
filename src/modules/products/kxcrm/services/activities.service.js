// src/modules/products/kxcrm/services/activities.service.js
//
// Engine service for lead activities. Signature: (userId, organizationId, ...).
// Permissions enforced at the route layer. No internal permission checks.

import activityDb from '../db/activity.db.js';
import leadDb from '../db/lead.db.js';
import audit from '../../../platform/audit/index.js';
import { assertActivityCreatePayload } from '../domain/activities/validation.js';
import { ValidationError, NotFoundError } from '../domain/errors.js';

// ============================================================
// HELPERS
// ============================================================

const assertLeadExists = async (organizationId, leadId) => {
  const lead = await leadDb.findById(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  return lead;
};

// ============================================================
// SYSTEM ACTIVITY (engine-internal, no user validation)
// ============================================================

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

// ============================================================
// USER-FACING LOG ACTIVITY
// ============================================================

const logActivity = async (userId, organizationId, leadId, payload) => {
  await assertLeadExists(organizationId, leadId);

  assertActivityCreatePayload(payload);

  const activity = await activityDb.create({
    organizationId,
    leadId,
    userId,
    type: payload.type,
    summary: payload.summary.trim(),
    outcome: payload.outcome ?? null,
    nextStep: payload.nextStep ?? null,
    nextStepDate: payload.nextStepDate ? new Date(payload.nextStepDate) : null,
    visitObjections: payload.type === 'VISIT' ? (payload.visitObjections ?? null) : null,
    visitDemoRequested: payload.type === 'VISIT' ? !!payload.visitDemoRequested : false,
    metadata: payload.metadata ?? null,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'ACTIVITY_LOGGED',
    resource: 'lead_activity',
    resourceId: activity.id,
    metadata: { leadId, type: activity.type, outcome: activity.outcome },
  });

  return activity;
};

// ============================================================
// LIST / COUNT
// ============================================================

const listForLead = async (userId, organizationId, leadId, filters = {}, pagination = {}) => {
  await assertLeadExists(organizationId, leadId);
  return activityDb.findByLead(organizationId, leadId, filters, pagination);
};

const countForLead = async (userId, organizationId, leadId) => {
  await assertLeadExists(organizationId, leadId);
  return { count: await activityDb.countByLead(organizationId, leadId) };
};

// ============================================================
// DELETE (NOTE only)
// ============================================================

const deleteActivity = async (userId, organizationId, activityId) => {
  const activity = await activityDb.findById(organizationId, activityId);
  if (!activity) throw new NotFoundError('ACTIVITY_NOT_FOUND', 'Activity not found');

  if (activity.type !== 'NOTE') {
    throw new ValidationError(
      'ACTIVITY_NOT_DELETABLE',
      'Only NOTE activities can be deleted; other activity types are immutable history'
    );
  }

  const count = await activityDb.remove(organizationId, activityId);
  if (count === 0) throw new NotFoundError('ACTIVITY_NOT_FOUND', 'Activity not found');

  await audit.log({
    organizationId,
    userId,
    action: 'ACTIVITY_DELETED',
    resource: 'lead_activity',
    resourceId: activityId,
    metadata: { leadId: activity.leadId, type: activity.type },
  });

  return { message: 'Activity deleted' };
};

export default {
  logActivity,
  logSystemActivity,
  listForLead,
  countForLead,
  deleteActivity,
};