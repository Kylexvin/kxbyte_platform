// src/modules/platform/payments/mpesa/mpesa.callback.service.js
//
// Handles the STK Push result callback from Safaricom.
//
// Safaricom POSTs an unsigned JSON body. We do not trust the payload to
// identify which tenant the callback belongs to. Instead, the callback URL
// contains a secret token, and we look up the transaction by that token.
//
// The token lookup is done by the ROUTE handler (extracting from req.params),
// and this service receives the resolved organizationId + the raw payload.

import prisma from '../../../../database/postgres/prisma.js';

/**
 * Process a Safaricom STK Push callback.
 *
 * Idempotent: calling twice with the same CheckoutRequestID is safe —
 * second call becomes a no-op (unless the payload differs materially).
 *
 * @param {Object} params
 * @param {string} params.organizationId  Resolved from the callback token
 * @param {Object} params.payload         Raw Safaricom callback body
 * @returns {Promise<{ ok: boolean, status: string, merchantRef: string|null }>}
 */
export const processCallback = async ({ organizationId, payload }) => {
  // ─── Parse the shape ───
  const stkCallback = payload?.Body?.stkCallback;
  if (!stkCallback) {
    return { ok: false, status: 'INVALID_PAYLOAD', merchantRef: null };
  }

  const {
    MerchantRequestID,
    CheckoutRequestID,
    ResultCode,
    ResultDesc,
    CallbackMetadata,
  } = stkCallback;

  if (!CheckoutRequestID) {
    return { ok: false, status: 'MISSING_CHECKOUT_ID', merchantRef: null };
  }

  // ─── Find the transaction ───
  const tx = await prisma.kxMpesaTransaction.findFirst({
    where: {
      organizationId,
      checkoutRequestId: CheckoutRequestID,
    },
  });

  if (!tx) {
    return { ok: false, status: 'TRANSACTION_NOT_FOUND', merchantRef: null };
  }

  // ─── Idempotency: if already terminal, no-op ───
  if (tx.status === 'SUCCESS' || tx.status === 'FAILED' || tx.status === 'TIMEOUT') {
    return { ok: true, status: tx.status, merchantRef: tx.merchantRef };
  }

  // ─── Extract metadata (receipt, amount, phone) from callback ───
  let mpesaReceiptNumber = null;
  if (Array.isArray(CallbackMetadata?.Item)) {
    for (const item of CallbackMetadata.Item) {
      if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
    }
  }

  // ─── Interpret result ───
  // ResultCode 0  → success
  // ResultCode 1032 → user cancelled
  // ResultCode 1, 2001, etc. → failure
  const isSuccess = Number(ResultCode) === 0;

  const nextStatus = isSuccess ? 'SUCCESS' : 'FAILED';

  const updated = await prisma.kxMpesaTransaction.update({
    where: { id: tx.id },
    data: {
      status: nextStatus,
      mpesaReceiptNumber: mpesaReceiptNumber || null,
      callbackPayload: stkCallback,
      failureReason: isSuccess ? null : (ResultDesc || 'Payment failed'),
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    status: updated.status,
    merchantRef: updated.merchantRef,
  };
};

/**
 * Mark stale PENDING transactions as TIMEOUT.
 * Called by the reconciler.
 */
export const timeoutStale = async (olderThanMs = 2 * 60 * 1000) => {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.kxMpesaTransaction.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    data: {
      status: 'TIMEOUT',
      failureReason: 'No callback received within timeout window',
      completedAt: new Date(),
    },
  });
  return result.count;
};

export default {
  processCallback,
  timeoutStale,
};