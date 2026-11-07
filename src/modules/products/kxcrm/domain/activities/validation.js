// src/modules/products/kxcrm/domain/activities/validation.js
//
// Pure validators for activity input. No I/O.
// Convention: `assertXxx(...)` throws ValidationError on violation.

import {
  USER_ACTIVITY_TYPES,
  OUTCOMES,
} from '../constants.js';
import { ValidationError } from '../errors.js';

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// ============================================================
// TYPE
// ============================================================

// User-supplied type must be one of USER_ACTIVITY_TYPES.
// STAGE_CHANGE is reserved for the engine and rejected here.
export const assertActivityType = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('ACTIVITY_TYPE_REQUIRED', 'Activity type is required');
  }
  if (value === 'STAGE_CHANGE') {
    throw new ValidationError(
      'ACTIVITY_TYPE_RESERVED',
      'STAGE_CHANGE activities are written by the system and cannot be logged manually'
    );
  }
  if (!USER_ACTIVITY_TYPES.includes(value)) {
    throw new ValidationError(
      'ACTIVITY_TYPE_INVALID',
      `Activity type must be one of: ${USER_ACTIVITY_TYPES.join(', ')}`
    );
  }
};

// ============================================================
// SUMMARY / OUTCOME
// ============================================================

export const assertSummary = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('ACTIVITY_SUMMARY_REQUIRED', 'Activity summary is required');
  }
  if (value.trim().length > 500) {
    throw new ValidationError('ACTIVITY_SUMMARY_TOO_LONG', 'Summary must be 500 characters or fewer');
  }
};

export const assertOutcome = (value) => {
  if (value === undefined || value === null || value === '') return;
  if (!OUTCOMES.includes(value)) {
    throw new ValidationError(
      'OUTCOME_INVALID',
      `Outcome must be one of: ${OUTCOMES.join(', ')}`
    );
  }
};

// ============================================================
// NEXT STEP
// ============================================================

export const assertNextStep = (value) => {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || value.length > 500) {
    throw new ValidationError('NEXT_STEP_INVALID', 'Next step must be a string of 500 characters or fewer');
  }
};

export const assertNextStepDate = (value) => {
  if (value === undefined || value === null || value === '') return;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('NEXT_STEP_DATE_INVALID', 'Next step date must be a valid date');
  }
};

// ============================================================
// VISIT-ONLY FIELDS
// ============================================================

// visitObjections + visitDemoRequested only valid when type === 'VISIT'.
// Service must call this AFTER assertActivityType.
export const assertVisitFields = (payload = {}) => {
  const hasVisitFields =
    Object.prototype.hasOwnProperty.call(payload, 'visitObjections') ||
    Object.prototype.hasOwnProperty.call(payload, 'visitDemoRequested');

  if (!hasVisitFields) return;

  if (payload.type !== 'VISIT') {
    throw new ValidationError(
      'VISIT_FIELDS_NOT_ALLOWED',
      'visitObjections and visitDemoRequested are only valid for VISIT activities'
    );
  }

  if (
    payload.visitObjections !== undefined &&
    payload.visitObjections !== null &&
    payload.visitObjections !== '' &&
    (typeof payload.visitObjections !== 'string' || payload.visitObjections.length > 2000)
  ) {
    throw new ValidationError(
      'VISIT_OBJECTIONS_INVALID',
      'visitObjections must be a string of 2000 characters or fewer'
    );
  }

  if (
    payload.visitDemoRequested !== undefined &&
    payload.visitDemoRequested !== null &&
    typeof payload.visitDemoRequested !== 'boolean'
  ) {
    throw new ValidationError(
      'VISIT_DEMO_INVALID',
      'visitDemoRequested must be a boolean'
    );
  }
};

// ============================================================
// COMPOSITE VALIDATOR
// ============================================================

export const assertActivityCreatePayload = (payload = {}) => {
  assertActivityType(payload.type);
  assertSummary(payload.summary);
  assertOutcome(payload.outcome);
  assertNextStep(payload.nextStep);
  assertNextStepDate(payload.nextStepDate);
  assertVisitFields(payload);
};