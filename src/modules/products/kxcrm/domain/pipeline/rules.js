// src/modules/products/kxcrm/domain/pipeline/rules.js
//
// Pure validators. No I/O, no imports from outside kxcrm/domain.
// Each function throws on violation, returns undefined on pass.
//
// Convention: `assertXxx(...)` — the service calls them in sequence.

import {
  ValidationError,
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

export const assertSingleWonStage = (stages, { excludeStageId } = {}) => {
  const existing = stages.find((s) => s.isWon && s.id !== excludeStageId);
  if (existing) {
    throw new ValidationError(
      'WON_STAGE_EXISTS',
      `A Won stage already exists ('${existing.name}'). Only one Won stage is allowed per organization.`
    );
  }
};

export const assertSingleLostStage = (stages, { excludeStageId } = {}) => {
  const existing = stages.find((s) => s.isLost && s.id !== excludeStageId);
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
// MOVE GUARD — moving a LEAD between NON-TERMINAL stages
// ============================================================
//
// `moveLeadToStage` handles moves between non-terminal stages only.
// Moving INTO Won is a distinct operation handled by `promoteLeadToWon`
// and gated by admin.leads.convert at the route layer.
//
// What's allowed (backwards drags are legitimate):
//   - Won  → Negotiation      ✅  (mark Won by mistake, drag back)
//   - Lost → Qualified        ✅  ("reopen" a lost lead)
//   - Any  → Lost             ✅  IF payload includes lostReason (service-enforced)
//   - Any  → Any active non-Won stage ✅
//
// What's blocked here:
//   - Any  → disabled stage           → CANT_MOVE_TO_DISABLED_STAGE
//   - Any  → Won (use promote route)  → USE_PROMOTE_ENDPOINT
//
// Side effects the SERVICE (not this rule) must apply on a move:
//   - Target is Lost: set lostAt = now, lostReason from payload (required).
//   - Target is NOT Lost: clear lostAt = null, lostReason = null
export const assertCanMoveToStage = (targetStage) => {
  if (!targetStage.isActive) {
    throw new ValidationError(
      'CANT_MOVE_TO_DISABLED_STAGE',
      'Cannot move a lead to a disabled stage'
    );
  }
  if (targetStage.isWon) {
    throw new ValidationError(
      'USE_PROMOTE_ENDPOINT',
      'Use the promote endpoint to move a lead into the Won stage'
    );
  }
};

// ============================================================
// PROMOTE GUARD — moving a LEAD into the Won stage
// ============================================================
//
// Called by `promoteLeadToWon`. Route-gated by admin.leads.convert.
//
// What's blocked here:
//   - target is not a Won stage  → NOT_WON_STAGE
//   - target is disabled         → CANT_MOVE_TO_DISABLED_STAGE
export const assertCanPromoteToWon = (targetStage) => {
  if (!targetStage.isWon) {
    throw new ValidationError(
      'NOT_WON_STAGE',
      'The promote endpoint only moves leads into the Won stage'
    );
  }
  if (!targetStage.isActive) {
    throw new ValidationError(
      'CANT_MOVE_TO_DISABLED_STAGE',
      'Cannot move a lead to a disabled stage'
    );
  }
};

// ============================================================
// CONVERTED-LEAD LOCK
// ============================================================

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