// src/modules/products/kxcrm/domain/constants.js
//
// Engine-owned constant sets. Surfaces may use them for UI dropdowns
// and wizard previews; the engine uses them for validation.

// ============================================================
// ACTIVITY TYPES
// ============================================================

export const ACTIVITY_TYPES = Object.freeze([
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'VISIT',
  'MEETING',
  'NOTE',
  'STAGE_CHANGE', // engine-only — never accepted from user input
]);

export const USER_ACTIVITY_TYPES = Object.freeze(
  ACTIVITY_TYPES.filter((t) => t !== 'STAGE_CHANGE')
);

export const SYSTEM_ACTIVITY_TYPES = Object.freeze(['STAGE_CHANGE']);

// ============================================================
// LEAD SOURCES
// ============================================================

export const LEAD_SOURCES = Object.freeze([
  'SHOP_VISIT',
  'WEBSITE',
  'TIKTOK',
  'INSTAGRAM',
  'REFERRAL',
  'DIRECT_CALL',
  'WHATSAPP',
  'CAMPAIGN',
  'OTHER',
]);

// ============================================================
// BUSINESS SIZES
// ============================================================

export const BUSINESS_SIZES = Object.freeze([
  'SMALL',
  'MEDIUM',
  'LARGE',
]);

// ============================================================
// ACTIVITY OUTCOMES
// ============================================================

export const OUTCOMES = Object.freeze([
  'POSITIVE',
  'NEUTRAL',
  'NEGATIVE',
]);

// ============================================================
// DEFAULT PIPELINE TEMPLATE
// ============================================================
//
// Suggestion only. Surfaces (e.g. admin's pipeline-template.service)
// may offer this to a user during setup. The engine never applies it
// automatically; orgs are free to build their own stages.
//
// isTerminal is derived (isWon || isLost) by the service on create.
// Template entries deliberately omit it.

export const PIPELINE_TEMPLATE = Object.freeze([
  { name: 'New',         key: 'new',         order: 1, isWon: false, isLost: false },
  { name: 'Contacted',   key: 'contacted',   order: 2, isWon: false, isLost: false },
  { name: 'Qualified',   key: 'qualified',   order: 3, isWon: false, isLost: false },
  { name: 'Demo',        key: 'demo',        order: 4, isWon: false, isLost: false },
  { name: 'Proposal',    key: 'proposal',    order: 5, isWon: false, isLost: false },
  { name: 'Negotiation', key: 'negotiation', order: 6, isWon: false, isLost: false },
  { name: 'Won',         key: 'won',         order: 7, isWon: true,  isLost: false },
  { name: 'Lost',        key: 'lost',        order: 8, isWon: false, isLost: true  },
]);