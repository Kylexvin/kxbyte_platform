// src/modules/platform/payments/crypto.js
//
// Application-layer encryption for payment credentials.
//
// Uses AES-256-GCM. Ciphertext format:
//   v1:<keyId>:<iv-hex>:<tag-hex>:<ciphertext-hex>
//
// The prefix is the encryption format version, and <keyId> identifies
// which master key was used. This allows key rotation: old ciphertexts
// decrypt with their original key, new ones use the current key.
//
// Requires MASTER_ENCRYPTION_KEY in env — 64 hex chars (32 bytes).
// Optional: MASTER_ENCRYPTION_KEY_ID — a short label for the current key
// (defaults to "v1"). When rotating, increment this and keep the old key
// available under MASTER_ENCRYPTION_KEY_<ID> until all ciphertexts are
// re-encrypted.

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // GCM standard, 96 bits
const TAG_LENGTH = 16;  // GCM standard, 128 bits
const KEY_LENGTH = 32;  // 256 bits
const FORMAT_VERSION = 'v1';

const HEX_RE = /^[0-9a-fA-F]+$/;

const getKey = (keyId) => {
  // Primary key
  const primaryId = process.env.MASTER_ENCRYPTION_KEY_ID || 'v1';

  // Determine which env var to read
  const envVar =
    keyId === primaryId
      ? 'MASTER_ENCRYPTION_KEY'
      : `MASTER_ENCRYPTION_KEY_${keyId.toUpperCase()}`;

  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`Encryption key not configured: ${envVar}`);
  }
  if (raw.length !== KEY_LENGTH * 2 || !HEX_RE.test(raw)) {
    throw new Error(`${envVar} must be ${KEY_LENGTH * 2} hex characters`);
  }
  return Buffer.from(raw, 'hex');
};

const getCurrentKeyId = () => process.env.MASTER_ENCRYPTION_KEY_ID || 'v1';

const isHex = (s, expectedBytes) =>
  typeof s === 'string' &&
  s.length === expectedBytes * 2 &&
  HEX_RE.test(s);

/**
 * Encrypt a UTF-8 string.
 * @param {string} plaintext
 * @returns {string} "v1:<keyId>:<iv>:<tag>:<ciphertext>" (hex segments)
 */
export const encrypt = (plaintext) => {
  if (typeof plaintext !== 'string') {
    throw new Error('encrypt: plaintext must be a string');
  }
  if (plaintext.length === 0) {
    throw new Error('encrypt: plaintext must not be empty');
  }

  const keyId = getCurrentKeyId();
  const key = getKey(keyId);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    keyId,
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
};

/**
 * Decrypt a value produced by `encrypt`.
 * Throws a generic error on any failure — never leaks cryptographic detail.
 * @param {string} payload
 * @returns {string} plaintext
 */
export const decrypt = (payload) => {
  const fail = () => new Error('Decryption failed');

  if (typeof payload !== 'string') throw fail();

  const parts = payload.split(':');
  if (parts.length !== 5) throw fail();

  const [version, keyId, ivHex, tagHex, cipherHex] = parts;

  // Strict format checks — reject malformed input before touching buffers.
  if (version !== FORMAT_VERSION) throw fail();
  if (!keyId || keyId.length > 32 || !/^[a-z0-9_-]+$/i.test(keyId)) throw fail();
  if (!isHex(ivHex, IV_LENGTH)) throw fail();
  if (!isHex(tagHex, TAG_LENGTH)) throw fail();
  if (!cipherHex || !HEX_RE.test(cipherHex) || cipherHex.length % 2 !== 0) {
    throw fail();
  }

  let key;
  try {
    key = getKey(keyId);
  } catch {
    // Missing key for this ID — still fail closed without leaking which key.
    throw fail();
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    throw fail();
  }
};

/**
 * Encrypt any JSON-serializable value.
 * @param {any} value
 * @returns {string}
 */
export const encryptJson = (value) => {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('encryptJson: value is not JSON-serializable');
  }
  if (serialized === undefined) {
    throw new Error('encryptJson: value is undefined');
  }
  return encrypt(serialized);
};

/**
 * Decrypt to a parsed JSON value.
 * @param {string} payload
 * @returns {any}
 */
export const decryptJson = (payload) => {
  const plain = decrypt(payload);
  try {
    return JSON.parse(plain);
  } catch {
    throw new Error('Decryption failed');
  }
};

export default {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
};