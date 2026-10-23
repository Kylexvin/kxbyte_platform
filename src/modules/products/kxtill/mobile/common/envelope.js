// src/modules/products/kxtill/mobile/common/envelope.js
//
// Response shape for every KxTill Mobile endpoint.
//
// Why an envelope:
//   - Lets us attach `meta` (generatedAt, source, cursor) without
//     polluting the domain payload.
//   - Signals "this is a mobile response" so callers can't accidentally
//     use a web handler's shape.
//   - Gives us a place to evolve the contract (e.g. partialData warnings,
//     stale flags) without changing the top-level body.

/**
 * Wrap a payload in the standard mobile envelope.
 *
 * @param {*} data                       the actual payload
 * @param {object} [meta]                optional metadata
 * @param {string} [meta.source]         'live' | 'stub' | 'mock'
 * @param {boolean} [meta.stale]         true if data may be out of date
 * @param {object} [meta.extra]          anything endpoint-specific
 * @returns {{data: *, meta: object}}
 */
export function ok(data, meta = {}) {
  return {
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      source: meta.source || 'live',
      ...(meta.stale != null ? { stale: !!meta.stale } : {}),
      ...(meta.extra || {}),
    },
  };
}

/**
 * Standard error envelope. Mirrors the shape the mobile app already
 * handles from `/auth/*` so we do not introduce a second error contract.
 *
 * @param {string} code                  machine-readable, e.g. 'FORBIDDEN'
 * @param {string} message               human-readable
 * @param {object} [extra]               any additional fields
 */
export function fail(code, message, extra = {}) {
  return {
    error: code,
    message,
    ...extra,
  };
}

export default { ok, fail };