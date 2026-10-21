// src/modules/platform/identity/utils/allowedRedirects.js
//
// Single source of truth for OAuth client → allowed redirect URIs.
// Each client is an ARRAY because one app can have multiple platform
// redirects (web callback, mobile deep link, dev proxy, ...).
// Same client_id serves all platforms — the redirect_uri distinguishes them.

export const VALID_CLIENTS = [
  'kxtill',
  'kxtill-pharmacy',
  'kxinvoice',
  'kxcrm',
  'kxsuite',
];

export const ALLOWED_REDIRECTS = {
  kxtill: [
    process.env.KXTILL_REDIRECT_URI,
    process.env.KXTILL_MOBILE_REDIRECT_URI,
  ].filter(Boolean),

  'kxtill-pharmacy': [
    process.env.KXTILL_PHARMACY_REDIRECT_URI,
    process.env.KXTILL_PHARMACY_MOBILE_REDIRECT_URI,
  ].filter(Boolean),

  kxinvoice: [
    process.env.KXINVOICE_REDIRECT_URI,
    process.env.KXINVOICE_MOBILE_REDIRECT_URI,
  ].filter(Boolean),

  kxcrm: [
    process.env.KXCRM_REDIRECT_URI,
    process.env.KXCRM_MOBILE_REDIRECT_URI,
  ].filter(Boolean),

  kxsuite: [
    process.env.KXSUITE_REDIRECT_URI,
  ].filter(Boolean),
};

export function isValidClient(clientId) {
  return VALID_CLIENTS.includes(clientId);
}

export function isAllowedRedirect(clientId, redirectUri) {
  const list = ALLOWED_REDIRECTS[clientId];
  if (!Array.isArray(list) || !redirectUri) return false;
  return list.includes(redirectUri);
}