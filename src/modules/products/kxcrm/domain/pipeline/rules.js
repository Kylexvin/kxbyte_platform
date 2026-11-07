// src/modules/products/kxcrm/domain/pipeline/rules.js
//
// Pure validators. No I/O, no imports from outside kxcrm/domain.
// Each function throws on violation, returns undefined on pass.
//
// Convention: `assertXxx(...)` — the service calls them in sequence.

import {
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../errors.js';
// ============================================================
// KEY FORMAT
// ============================================================

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const assertValidKeyFormat = (key) => {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw new ValidationError(
      'INVALID_KEY_FORMAT',
      'Stage key must start with a lowercase letter and contain only lowercase letters, digits, or underscores'
    );
  }
};

// ============================================================
// WON / LOST UNIQUENESS
// ============================================================

// stages: all existing stages in the org (active or inactive).
// excludeStageId: stage being updated — skip it in the check.
export const assertSingleWonStage = (stages, { excludeStageId } = {}) => {
  const existing = stages.find(
    (s) => s.isWon && s.id !== excludeStageId
  );
  if (existing) {
    throw new ValidationError(
      'WON_STAGE_EXISTS',
      `A Won stage already exists ('${existing.name}'). Only one Won stage is allowed per organization.`
    );
  }
};

export const assertSingleLostStage = (stages, { excludeStageId } = {}) => {
  const existing = stages.find(
    (s) => s.isLost && s.id !== excludeStageId
  );
  if (existing) {
    throw new ValidationError(
      'LOST_STAGE_EXISTS',
      `A Lost stage already exists ('${existing.name}'). Only one Lost stage is allowed per organization.`
    );
  }
};

// ============================================================
// TERMINAL CONSISTENCY
// ============================================================

// isTerminal is derived: must equal (isWon || isLost).
// Called by the service just before persist.
export const assertTerminalConsistency = ({ isWon, isLost, isTerminal }) => {
  const expected = !!(isWon || isLost);
  if (isTerminal !== expected) {
    throw new ValidationError(
      'TERMINAL_MISMATCH',
      'isTerminal must be true if and only if isWon or isLost is true'
    );
  }
};

// ============================================================
// DISABLE / DELETE GUARDS
// ============================================================

// A stage can be disabled (isActive: false) unless leads still sit in it.
// Strict: any lead in any stage blocks disable. Forces explicit reassign.
export const assertCanDisableStage = (stage, leadCount) => {
  if (leadCount === 0) return;

  if (stage.isWon) {
    throw new ValidationError(
      'CANT_DISABLE_WON_WITH_LEADS',
      `Cannot disable the Won stage while ${leadCount} lead(s) are in it. Reassign them first.`
    );
  }
  if (stage.isLost) {
    throw new ValidationError(
      'CANT_DISABLE_LOST_WITH_LEADS',
      `Cannot disable the Lost stage while ${leadCount} lead(s) are in it. Reassign them first.`
    );
  }
  throw new ValidationError(
    'STAGE_HAS_LEADS',
    `Cannot disable stage while ${leadCount} lead(s) are in it. Reassign them first.`
  );
};

// Delete guard:
//   - any lead in stage → refuse
//   - Won/Lost stage → refuse (even if empty; it's the anchor)
export const assertCanDeleteStage = (stage, leadCount, { wonStage, lostStage } = {}) => {
  if (leadCount > 0) {
    throw new ValidationError(
      'STAGE_HAS_LEADS',
      `Cannot delete stage while ${leadCount} lead(s) are in it. Reassign them first.`
    );
  }

  if (stage.isWon && wonStage?.id === stage.id) {
    throw new ValidationError(
      'CANT_DELETE_WON_STAGE',
      'Cannot delete the Won stage. Mark another stage as Won first, or disable this one.'
    );
  }
  if (stage.isLost && lostStage?.id === stage.id) {
    throw new ValidationError(
      'CANT_DELETE_LOST_STAGE',
      'Cannot delete the Lost stage. Mark another stage as Lost first, or disable this one.'
    );
  }
};

// ============================================================
// MOVE GUARD — moving a LEAD between stages
// ============================================================
//
// What this function decides: whether a target stage is a legal destination
// for a lead move RIGHT NOW, based on the target's state and the caller's
// permission result. It does NOT care which stage the lead is currently in.
//
// What's allowed (backwards drags are legitimate):
//   - Won  → Negotiation      ✅  (mark Won by mistake, drag back)
//   - Lost → Qualified        ✅  ("reopen" a lost lead)
//   - Negotiation → Won       ✅  IF caller has crm.leads.convert
//   - Any  → Lost             ✅  IF payload includes lostReason (service-enforced)
//   - Any  → Any active stage ✅  (no forward/backward distinction at the rule level)
//
// What's blocked:
//   - Any  → disabled stage           → ValidationError CANT_MOVE_TO_DISABLED_STAGE
//   - Any  → Won without permission   → ForbiddenError   REQUIRES_CONVERT_PERMISSION
//
// Side effects the SERVICE (not this rule) must apply on a move:
//   - Target is Lost: set lostAt = now, lostReason from payload (required).
//   - Target is NOT Lost: clear lostAt = null, lostReason = null
//     (so a Lost → Negotiation drag doesn't leave stale "lost" data).
//   - Target is Won and lead was NOT previously Won: leave for the
//     separate convert flow (see assertNotConverted below).
//
// canConvert: boolean — service must call context.can('crm.leads.convert')
//             and pass the result in. Domain stays pure.
export const assertCanMoveToStage = (targetStage, { canConvert } = {}) => {
  if (!targetStage.isActive) {
    throw new ValidationError(
      'CANT_MOVE_TO_DISABLED_STAGE',
      'Cannot move a lead to a disabled stage'
    );
  }
  if (targetStage.isWon && !canConvert) {
    throw new ForbiddenError(
      'REQUIRES_CONVERT_PERMISSION',
      'You do not have permission to move leads into the Won stage'
    );
  }
};

// ============================================================
// CONVERTED-LEAD LOCK
// ============================================================
//
// Once a lead has been converted into an Organization, it becomes a
// historical record. Moving it to another stage, or trying to convert
// it again, is blocked here.
//
// Rationale: a converted lead points at a real Organization row via
// convertedOrganizationId. Its stage is frozen at Won. If you want to
// "undo," that's an org-archive operation on the Organization, not a
// lead mutation.
export const assertNotConverted = (lead) => {
  if (lead?.convertedOrganizationId) {
    throw new ConflictError(
      'LEAD_ALREADY_CONVERTED',
      'This lead has already been converted to an organization and cannot be moved or re-converted.'
    );
  }
};

// ============================================================
// REORDER GUARD
// ============================================================

// updates: [{ id, order }]
// existing: full stage list for the org (active or inactive)
//
// Enforces:
//   1. Completeness — every existing stage must be present in updates,
//      and updates must not contain extras. Otherwise a partial reorder
//      can renumber some stages and leave others colliding on the same
//      order value. The client always has the full list; require it.
//   2. Membership — every id belongs to the org.
//   3. Order validity — non-negative integers.
//   4. No duplicate order values across updates.
export const assertValidReorder = (updates, existing) => {
  if (updates.length !== existing.length) {
    throw new ValidationError(
      'INCOMPLETE_REORDER',
      `Reorder must include every stage (expected ${existing.length}, received ${updates.length})`
    );
  }

  const byId = new Map(existing.map((s) => [s.id, s]));
  const seenOrder = new Map();

  for (const { id, order } of updates) {
    if (!byId.has(id)) {
      throw new ValidationError(
        'STAGE_NOT_FOUND',
        `Stage ${id} not found in this organization`
      );
    }
    if (!Number.isInteger(order) || order < 0) {
      throw new ValidationError(
        'INVALID_ORDER',
        `Order must be a non-negative integer (stage ${id})`
      );
    }
    if (seenOrder.has(order)) {
      throw new ValidationError(
        'DUPLICATE_ORDER',
        `Duplicate order value ${order} for stages ${seenOrder.get(order)} and ${id}`
      );
    }
    seenOrder.set(order, id);
  }
};