// src/modules/platform/payments/mpesa/mpesa.config.service.js
//
// Manages a tenant's Daraja credentials.
//
// Responsibilities:
//   - Save config (encrypts credentials before writing)
//   - Read config (decrypts for internal use only — never for API responses)
//   - Mask config for API responses (never returns secrets)
//   - Test credentials by calling Daraja OAuth
//   - Delete config

import crypto from 'node:crypto';
import prisma from '../../../../database/postgres/prisma.js';
import { encrypt, decrypt } from '../crypto.js';

const DARAJA_BASE = {
  SANDBOX: 'https://sandbox.safaricom.co.ke',
  PRODUCTION: 'https://api.safaricom.co.ke',
};

const VALID_ENVIRONMENTS = ['SANDBOX', 'PRODUCTION'];
const VALID_SHORTCODE_TYPES = ['PAYBILL', 'TILL'];

// ─── validation ──────────────────────────────────────────────

const validateInput = (data) => {
  const errors = [];
  const {
    consumerKey,
    consumerSecret,
    passkey,
    shortcode,
    environment,
    shortcodeType = 'PAYBILL',
  } = data || {};

  if (!consumerKey || typeof consumerKey !== 'string' || consumerKey.length < 20) {
    errors.push('consumerKey is required and must be at least 20 characters');
  }
  if (!consumerSecret || typeof consumerSecret !== 'string' || consumerSecret.length < 20) {
    errors.push('consumerSecret is required and must be at least 20 characters');
  }
  if (!passkey || typeof passkey !== 'string' || passkey.length < 20) {
    errors.push('passkey is required and must be at least 20 characters');
  }
  if (!shortcode || !/^\d{5,7}$/.test(String(shortcode))) {
    errors.push('shortcode must be 5–7 digits');
  }
  if (!environment || !VALID_ENVIRONMENTS.includes(environment)) {
    errors.push(`environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }
  if (!VALID_SHORTCODE_TYPES.includes(shortcodeType)) {
    errors.push('shortcodeType must be PAYBILL or TILL');
  }

  return errors;
};

// ─── masking for API responses ───────────────────────────────

const toApiShape = (row) => {
  if (!row) return null;
  // Never decrypt here. Return masked placeholders — enough for the UI to
  // show "configured: yes" without exposing the secret.
  return {
    id: row.id,
    organizationId: row.organizationId,
    environment: row.environment,
    shortcode: row.shortcode,
    shortcodeType: row.shortcodeType || 'PAYBILL',
    isActive: row.isActive,
    lastTestedAt: row.lastTestedAt,
    lastTestResult: row.lastTestResult,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // masked previews — never the real values
    consumerKeyMasked: null,
    consumerSecretMasked: null,
    passkeyMasked: null,
    // a boolean so UI can render "credentials set"
    credentialsConfigured: true,
    callbackToken: row.callbackToken,
  };
};

// ─── internal read (decrypts) ────────────────────────────────

/**
 * Load the tenant's config with decrypted credentials.
 * FOR INTERNAL USE ONLY — never return this object to API callers.
 */
export const loadDecryptedConfig = async (organizationId) => {
  const row = await prisma.kxMpesaConfig.findUnique({
    where: { organizationId },
  });
  if (!row) throw new Error('M-Pesa is not configured for this organization');
  if (!row.isActive) throw new Error('M-Pesa is disabled for this organization');

  let consumerKey, consumerSecret, passkey;
  try {
    consumerKey = decrypt(row.consumerKeyEnc);
    consumerSecret = decrypt(row.consumerSecretEnc);
    passkey = decrypt(row.passkeyEnc);
  } catch {
    // Do not leak ciphertext or crypto detail
    throw new Error(
      'Stored M-Pesa credentials could not be decrypted. Please re-enter them.'
    );
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    environment: row.environment,
    baseUrl: DARAJA_BASE[row.environment],
    consumerKey,
    consumerSecret,
    passkey,
    shortcode: row.shortcode,
    shortcodeType: row.shortcodeType || 'PAYBILL',
    callbackToken: row.callbackToken,
    isActive: row.isActive,
  };
};

// ─── public API ──────────────────────────────────────────────

/**
 * Save (create or update) the org's M-Pesa config.
 * Encrypts credentials before writing.
 */
export const saveConfig = async (organizationId, data) => {
  const errors = validateInput(data);
  if (errors.length > 0) {
    const err = new Error(errors.join('; '));
    err.validationErrors = errors;
    throw err;
  }

  const {
    consumerKey,
    consumerSecret,
    passkey,
    shortcode,
    environment,
    shortcodeType = 'PAYBILL',
  } = data;

  const consumerKeyEnc = encrypt(consumerKey.trim());
  const consumerSecretEnc = encrypt(consumerSecret.trim());
  const passkeyEnc = encrypt(passkey.trim());

  // Generate a callback token only on first save.
  const existing = await prisma.kxMpesaConfig.findUnique({
    where: { organizationId },
    select: { callbackToken: true },
  });
  const callbackToken =
    existing?.callbackToken ||
    crypto.randomBytes(32).toString('hex');

  const row = await prisma.kxMpesaConfig.upsert({
    where: { organizationId },
    update: {
      environment,
      shortcode: String(shortcode),
      shortcodeType,
      consumerKeyEnc,
      consumerSecretEnc,
      passkeyEnc,
      isActive: true,
      lastTestResult: 'UNTESTED',
      lastTestedAt: null,
    },
    create: {
      organizationId,
      environment,
      shortcode: String(shortcode),
      shortcodeType,
      consumerKeyEnc,
      consumerSecretEnc,
      passkeyEnc,
      callbackToken,
      isActive: true,
      lastTestResult: 'UNTESTED',
    },
  });

  return toApiShape(row);
};

/**
 * Read the org's config for API responses.
 * Never returns secrets.
 */
export const getMaskedConfig = async (organizationId) => {
  const row = await prisma.kxMpesaConfig.findUnique({
    where: { organizationId },
  });
  return row ? toApiShape(row) : null;
};

/**
 * Delete the org's config entirely.
 * Frees the callback token for future reuse (if they re-enable).
 */
export const deleteConfig = async (organizationId) => {
  await prisma.kxMpesaConfig.delete({
    where: { organizationId },
  });
  return { deleted: true };
};

/**
 * Test credentials by calling Daraja OAuth.
 * Does not change any other state except lastTestedAt / lastTestResult.
 */
export const testCredentials = async (organizationId) => {
  const config = await loadDecryptedConfig(organizationId);

  const auth = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString('base64');

  const url = `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body.access_token) {
      await prisma.kxMpesaConfig.update({
        where: { organizationId },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: 'FAILED',
        },
      });
      return {
        ok: false,
        reason: body.errorMessage || `Daraja responded ${res.status}`,
      };
    }

    await prisma.kxMpesaConfig.update({
      where: { organizationId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: 'OK',
      },
    });
    return { ok: true };
  } catch (err) {
    await prisma.kxMpesaConfig.update({
      where: { organizationId },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: 'FAILED',
      },
    });
    return { ok: false, reason: 'Network error reaching Daraja' };
  }
};

export default {
  saveConfig,
  getMaskedConfig,
  deleteConfig,
  testCredentials,
  loadDecryptedConfig,
};