// src/modules/products/kxcrm/services/pipeline.service.js
//
// Engine service for pipeline stages.
// Signature convention: (userId, organizationId, ...args) — matches
// the rest of the platform's product services.
//
// Permissions: crm.pipeline.view, crm.pipeline.manage.
// Templates are the surface's concern (admin/crm today, KxCRM later);
// this service has no knowledge of any specific stage list.

import pipelineDb from '../db/pipeline.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import {
  assertValidKeyFormat,
  assertSingleWonStage,
  assertSingleLostStage,
  assertTerminalConsistency,
  assertCanDisableStage,
  assertCanDeleteStage,
  assertValidReorder,
} from '../domain/pipeline/rules.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../domain/errors.js';

// ============================================================
// HELPERS
// ============================================================

const assertPermission = async (userId, organizationId, key, message) => {
  const ok = await authorizationService.checkPermission(userId, organizationId, key);
  if (!ok) throw new ForbiddenError('FORBIDDEN', message);
};

// ============================================================
// LIST / STATUS
// ============================================================

const listStages = async (userId, organizationId, { includeInactive = false } = {}) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.view', 'You do not have permission to view the pipeline');
  return pipelineDb.findByOrg(organizationId, { includeInactive });
};

const getStage = async (userId, organizationId, stageId) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.view', 'You do not have permission to view the pipeline');
  const stage = await pipelineDb.findById(organizationId, stageId);
  if (!stage) throw new NotFoundError('STAGE_NOT_FOUND', 'Stage not found');
  return stage;
};

// { isReady, wonStageId, lostStageId }
// isReady = exactly one Won and one Lost are configured (any active state).
// The engine uses this to gate lead creation.
const getStatus = async (userId, organizationId) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.view', 'You do not have permission to view the pipeline');

  const won = await pipelineDb.findWonStage(organizationId);
  const lost = await pipelineDb.findLostStage(organizationId);

  return {
    isReady: !!(won && lost),
    wonStageId: won?.id || null,
    lostStageId: lost?.id || null,
    wonStageActive: won?.isActive ?? null,
    lostStageActive: lost?.isActive ?? null,
  };
};

// ============================================================
// CREATE
// ============================================================

const createStage = async (userId, organizationId, payload) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.manage', 'You do not have permission to manage the pipeline');

  assertValidKeyFormat(payload.key);

  if (await pipelineDb.existsByKey(organizationId, payload.key)) {
    throw new ValidationError('KEY_EXISTS', `Stage key '${payload.key}' already exists in this organization`);
  }

  // Uniqueness is enforced across ACTIVE stages only.
  // Inactive Won/Lost stubs coexist with the active one; they're history.
  const activeStages = await pipelineDb.findByOrg(organizationId, { includeInactive: false });
  if (payload.isWon) assertSingleWonStage(activeStages);
  if (payload.isLost) assertSingleLostStage(activeStages);

  const isWon = !!payload.isWon;
  const isLost = !!payload.isLost;
  const isTerminal = isWon || isLost;
  assertTerminalConsistency({ isWon, isLost, isTerminal });

  const stage = await pipelineDb.create({
    organizationId,
    name: payload.name,
    key: payload.key,
    order: payload.order,
    isWon,
    isLost,
    isTerminal,
    color: payload.color ?? null,
    isActive: payload.isActive !== undefined ? !!payload.isActive : true,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'PIPELINE_STAGE_CREATED',
    resource: 'pipeline_stage',
    resourceId: stage.id,
    metadata: {
      name: stage.name,
      key: stage.key,
      isWon: stage.isWon,
      isLost: stage.isLost,
    },
  });

  return stage;
};

// ============================================================
// UPDATE
// ============================================================

const updateStage = async (userId, organizationId, stageId, payload) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.manage', 'You do not have permission to manage the pipeline');

  const stage = await pipelineDb.findById(organizationId, stageId);
  if (!stage) throw new NotFoundError('STAGE_NOT_FOUND', 'Stage not found');

  if (payload.key !== undefined) {
    assertValidKeyFormat(payload.key);
    const clash = await pipelineDb.existsByKey(organizationId, payload.key, { excludeStageId: stageId });
    if (clash) throw new ValidationError('KEY_EXISTS', `Stage key '${payload.key}' already exists`);
  }

  // Compute what the stage will look like after the update.
  const nextIsWon = payload.isWon !== undefined ? !!payload.isWon : stage.isWon;
  const nextIsLost = payload.isLost !== undefined ? !!payload.isLost : stage.isLost;
  const nextIsActive = payload.isActive !== undefined ? !!payload.isActive : stage.isActive;
  const nextIsTerminal = nextIsWon || nextIsLost;

  assertTerminalConsistency({ isWon: nextIsWon, isLost: nextIsLost, isTerminal: nextIsTerminal });

  // Uniqueness over active stages only (inactive stubs are history).
  const activeStages = await pipelineDb.findByOrg(organizationId, { includeInactive: false });
  if (nextIsWon && !stage.isWon) assertSingleWonStage(activeStages, { excludeStageId: stageId });
  if (nextIsLost && !stage.isLost) assertSingleLostStage(activeStages, { excludeStageId: stageId });

  // Disable guard: if we're setting isActive → false, no leads may sit in this stage.
  if (stage.isActive && nextIsActive === false) {
    const leadCount = await pipelineDb.countLeadsInStage(organizationId, stageId);
    assertCanDisableStage({ ...stage, isWon: nextIsWon, isLost: nextIsLost }, leadCount);
  }

  const update = {};
  if (payload.name !== undefined)     update.name = payload.name;
  if (payload.key !== undefined)      update.key = payload.key;
  if (payload.order !== undefined)    update.order = payload.order;
  if (payload.color !== undefined)    update.color = payload.color;
  if (payload.isWon !== undefined)    update.isWon = nextIsWon;
  if (payload.isLost !== undefined)   update.isLost = nextIsLost;
  if (payload.isActive !== undefined) update.isActive = nextIsActive;

  // isTerminal is derived; only write when isWon/isLost actually changed.
  if (payload.isWon !== undefined || payload.isLost !== undefined) {
    update.isTerminal = nextIsTerminal;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('NOTHING_TO_UPDATE', 'No valid fields to update');
  }

  const updated = await pipelineDb.update(organizationId, stageId, update);

  await audit.log({
    organizationId,
    userId,
    action: 'PIPELINE_STAGE_UPDATED',
    resource: 'pipeline_stage',
    resourceId: stageId,
    metadata: {
      name: updated.name,
      updatedFields: Object.keys(update),
    },
  });

  return updated;
};

// ============================================================
// REORDER
// ============================================================

const reorderStages = async (userId, organizationId, updates) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.manage', 'You do not have permission to manage the pipeline');

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('INVALID_REORDER_PAYLOAD', 'Reorder payload must be a non-empty array of { id, order }');
  }

  const existing = await pipelineDb.findByOrg(organizationId, { includeInactive: true });
  assertValidReorder(updates, existing);

  const result = await pipelineDb.reorder(organizationId, updates);

  await audit.log({
    organizationId,
    userId,
    action: 'PIPELINE_STAGES_REORDERED',
    resource: 'pipeline',
    resourceId: null,
    metadata: {
      count: updates.length,
      order: updates.map((u) => ({ id: u.id, order: u.order })),
    },
  });

  return result;
};

// ============================================================
// DELETE
// ============================================================

const deleteStage = async (userId, organizationId, stageId) => {
  await assertPermission(userId, organizationId, 'crm.pipeline.manage', 'You do not have permission to manage the pipeline');

  const stage = await pipelineDb.findById(organizationId, stageId);
  if (!stage) throw new NotFoundError('STAGE_NOT_FOUND', 'Stage not found');

  const leadCount = await pipelineDb.countLeadsInStage(organizationId, stageId);
  // Only an ACTIVE Won/Lost blocks deletion. Inactive stubs can be
  // cleaned up (as long as no leads sit in them).
  const wonStage = await pipelineDb.findActiveWonStage(organizationId);
  const lostStage = await pipelineDb.findActiveLostStage(organizationId);

  assertCanDeleteStage(stage, leadCount, { wonStage, lostStage });

  const count = await pipelineDb.remove(organizationId, stageId);
  if (count === 0) throw new NotFoundError('STAGE_NOT_FOUND', 'Stage not found');

  await audit.log({
    organizationId,
    userId,
    action: 'PIPELINE_STAGE_DELETED',
    resource: 'pipeline_stage',
    resourceId: stageId,
    metadata: {
      name: stage.name,
      key: stage.key,
    },
  });

  return { message: 'Stage deleted' };
};

export default {
  listStages,
  getStage,
  getStatus,
  createStage,
  updateStage,
  reorderStages,
  deleteStage,
};