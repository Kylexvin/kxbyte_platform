// src/modules/products/kxcrm/domain/leads/validation.js
//
// Pure validators for lead input. No I/O.
// Convention: `assertXxx(...)` throws ValidationError on violation.

import {
  LEAD_SOURCES,
  BUSINESS_SIZES,
} from '../constants.js';
import { ValidationError } from '../errors.js';

// ============================================================
// PRIMITIVE CHECKS
// ============================================================

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// ============================================================
// FIELD VALIDATORS
// ============================================================

const assertBusinessName = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('BUSINESS_NAME_REQUIRED', 'Business name is required');
  }
  const trimmed = value.trim();
  if (trimmed.length > 200) {
    throw new ValidationError('BUSINESS_NAME_TOO_LONG', 'Business name must be 200 characters or fewer');
  }
};

const assertContactName = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('CONTACT_NAME_REQUIRED', 'Contact name is required');
  }
  if (value.trim().length > 200) {
    throw new ValidationError('CONTACT_NAME_TOO_LONG', 'Contact name must be 200 characters or fewer');
  }
};

// Loose phone validation: at least 7 digits, max 30 chars.
// Phone formats vary too much to enforce a country-specific pattern.
const assertContactPhone = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('CONTACT_PHONE_REQUIRED', 'Contact phone is required');
  }
  const trimmed = value.trim();
  if (trimmed.length > 30) {
    throw new ValidationError('CONTACT_PHONE_TOO_LONG', 'Contact phone must be 30 characters or fewer');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) {
    throw new ValidationError('CONTACT_PHONE_INVALID', 'Contact phone must contain at least 7 digits');
  }
};

// Optional. If provided, must look like an email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const assertContactEmail = (value) => {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || !EMAIL_RE.test(value.trim())) {
    throw new ValidationError('CONTACT_EMAIL_INVALID', 'Contact email must be a valid email address');
  }
};

const assertSource = (value) => {
  if (!isNonEmptyString(value)) {
    throw new ValidationError('SOURCE_REQUIRED', 'Lead source is required');
  }
  if (!LEAD_SOURCES.includes(value)) {
    throw new ValidationError(
      'SOURCE_INVALID',
      `Source must be one of: ${LEAD_SOURCES.join(', ')}`
    );
  }
};

const assertBusinessSize = (value) => {
  if (value === undefined || value === null || value === '') return;
  if (!BUSINESS_SIZES.includes(value)) {
    throw new ValidationError(
      'BUSINESS_SIZE_INVALID',
      `Business size must be one of: ${BUSINESS_SIZES.join(', ')}`
    );
  }
};

// dealValue: number | string | Decimal | null | undefined
// Accept anything Prisma's Decimal constructor accepts; validate range only.
const assertDealValue = (value) => {
  if (value === undefined || value === null || value === '') return;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError('DEAL_VALUE_INVALID', 'Deal value must be a valid number');
  }
  if (num < 0) {
    throw new ValidationError('DEAL_VALUE_NEGATIVE', 'Deal value cannot be negative');
  }
  if (num > 1_000_000_000) {
    throw new ValidationError('DEAL_VALUE_TOO_LARGE', 'Deal value exceeds maximum allowed');
  }
};

const CURRENCY_RE = /^[A-Z]{3}$/;

const assertCurrency = (value) => {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !CURRENCY_RE.test(value)) {
    throw new ValidationError(
      'CURRENCY_INVALID',
      'Currency must be a 3-letter uppercase ISO code (e.g. KES, USD)'
    );
  }
};

// ============================================================
// COMPOSITE VALIDATORS
// ============================================================

// Create: required fields enforced.
export const assertLeadCreatePayload = (payload = {}) => {
  assertBusinessName(payload.businessName);
  assertContactName(payload.contactName);
  assertContactPhone(payload.contactPhone);
  assertContactEmail(payload.contactEmail);
  assertSource(payload.source);
  assertBusinessSize(payload.businessSize);
  assertDealValue(payload.dealValue);
  assertCurrency(payload.currency);
};

// Update: only validate fields that are present.
// Never re-validates stage/lost/converted fields — those have their own flows.
export const assertLeadUpdatePayload = (payload = {}) => {
  if (Object.prototype.hasOwnProperty.call(payload, 'businessName')) {
    assertBusinessName(payload.businessName);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'contactName')) {
    assertContactName(payload.contactName);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'contactPhone')) {
    assertContactPhone(payload.contactPhone);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'contactEmail')) {
    assertContactEmail(payload.contactEmail);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'source')) {
    assertSource(payload.source);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'businessSize')) {
    assertBusinessSize(payload.businessSize);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'dealValue')) {
    assertDealValue(payload.dealValue);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'currency')) {
    assertCurrency(payload.currency);
  }
};