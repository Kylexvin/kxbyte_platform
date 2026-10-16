// src/modules/platform/payments/mpesa/mpesa.stk.service.js
//
// STK Push (Lipa Na M-Pesa Online) initiator.
//
// Flow:
//   1. Frontend sends { phone, amount, referenceType, referenceId }
//   2. Service loads tenant's Daraja config
//   3. Service fires STK Push to Daraja
//   4. Service stores a PENDING KxMpesaTransaction with checkoutRequestId
//   5. Returns { merchantRef, checkoutRequestId } — frontend polls
//   6. Callback later updates the transaction to SUCCESS / FAILED

import crypto from 'node:crypto';
import prisma from '../../../../database/postgres/prisma.js';
import mpesaConfigService from './mpesa.config.service.js';

// Safaricom wants timestamps in EAT (Africa/Nairobi), not UTC.
const eatTimestamp = () => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

// Daraja expects 2547XXXXXXXX — no plus, no leading 0.
const normalizePhone = (raw) => {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  if (!/^254\d{9}$/.test(p)) {
    throw new Error('Phone must be a valid Kenyan number (2547XXXXXXXX or 2541XXXXXXXX)');
  }
  return p;
};

// ─── OAuth token cache per organization ─────────────────────
// Token is valid ~1 hour. Cache it briefly to avoid hammering Daraja.

const tokenCache = new Map(); // orgId → { token, expiresAt }

const getAccessToken = async (config) => {
  const cached = tokenCache.get(config.organizationId);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const auth = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString('base64');

  const res = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const err = new Error('Failed to obtain Daraja access token');
    err.daraja = body;
    throw err;
  }

  // expires_in is in seconds, typically "3599"
  const ttlMs = (Number(body.expires_in) || 3599) * 1000;
  tokenCache.set(config.organizationId, {
    token: body.access_token,
    expiresAt: Date.now() + ttlMs,
  });

  return body.access_token;
};

// ─── Public API ──────────────────────────────────────────────

/**
 * Initiate an STK Push for a cart.
 *
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} params.phone          Raw or normalized
 * @param {number} params.amount         Positive number
 * @param {string} params.referenceType  e.g. 'pos_cart'
 * @param {string} params.referenceId    Frontend-generated id
 * @param {string} [params.productKey]   e.g. 'kxtill'
 * @param {string} params.callbackUrl    Full URL Safaricom POSTs to
 * @returns {Promise<{ merchantRef, checkoutRequestId, customerMessage }>}
 */
export const initiateStkPush = async ({
  organizationId,
  phone,
  amount,
  referenceType,
  referenceId,
  productKey = 'kxtill',
  callbackUrl,
}) => {
  if (!organizationId) throw new Error('organizationId is required');
  if (!phone) throw new Error('phone is required');
  if (!amount || Number(amount) <= 0) throw new Error('amount must be positive');
  if (!referenceType) throw new Error('referenceType is required');
  if (!referenceId) throw new Error('referenceId is required');
  if (!callbackUrl) throw new Error('callbackUrl is required');

  const normalizedPhone = normalizePhone(phone);
  const amountInt = Math.round(Number(amount));
  if (amountInt < 1) throw new Error('amount must be at least 1 KES');

  const config = await mpesaConfigService.loadDecryptedConfig(organizationId);
  const token = await getAccessToken(config);

  const timestamp = eatTimestamp();
  const password = Buffer.from(
    `${config.shortcode}${config.passkey}${timestamp}`
  ).toString('base64');

  const merchantRef = `KX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Daraja body
  const body = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amountInt,
    PartyA: normalizedPhone,
    PartyB: config.shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: merchantRef,
    TransactionDesc: 'KxTill',
  };

  const res = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const stkResponse = await res.json().catch(() => ({}));

  // Save transaction row regardless of outcome — audit + polling target
  const tx = await prisma.kxMpesaTransaction.create({
    data: {
      organizationId,
      referenceType,
      referenceId,
      productKey,
      merchantRef,
      checkoutRequestId: stkResponse.CheckoutRequestID || null,
      merchantRequestId: stkResponse.MerchantRequestID || null,
      amount: amountInt,
      currency: 'KES',
      phone: normalizedPhone,
      status: stkResponse.ResponseCode === '0' ? 'PENDING' : 'FAILED',
      stkResponse,
      failureReason:
        stkResponse.ResponseCode === '0'
          ? null
          : stkResponse.errorMessage || stkResponse.ResponseDescription || 'STK push failed',
    },
  });

  if (stkResponse.ResponseCode !== '0') {
    const err = new Error(
      stkResponse.errorMessage || 'STK push was rejected by Daraja'
    );
    err.daraja = stkResponse;
    err.transaction = tx;
    throw err;
  }

  return {
    merchantRef,
    checkoutRequestId: stkResponse.CheckoutRequestID,
    customerMessage: stkResponse.CustomerMessage || null,
  };
};

/**
 * Read a transaction by merchantRef for polling.
 * Returns a public-safe shape (no raw payloads with secrets).
 */
export const getTransactionByMerchantRef = async (organizationId, merchantRef) => {
  const tx = await prisma.kxMpesaTransaction.findFirst({
    where: { organizationId, merchantRef },
  });
  if (!tx) throw new Error('Transaction not found');

  return {
    merchantRef: tx.merchantRef,
    status: tx.status,
    amount: Number(tx.amount),
    currency: tx.currency,
    phone: tx.phone,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    failureReason: tx.failureReason,
    createdAt: tx.createdAt,
    completedAt: tx.completedAt,
  };
};

export default {
  initiateStkPush,
  getTransactionByMerchantRef,
};