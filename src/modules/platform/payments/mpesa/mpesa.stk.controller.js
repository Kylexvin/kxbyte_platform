// src/modules/platform/payments/mpesa/mpesa.stk.controller.js

import mpesaStkService from './mpesa.stk.service.js';
import mpesaCallbackService from './mpesa.callback.service.js';
import prisma from '../../../../database/postgres/prisma.js';

const buildCallbackUrl = (callbackToken) => {
  const base = process.env.PUBLIC_BACKEND_URL || 'http://localhost:5000';
  return `${base}/api/v1/payments/mpesa/callback/${callbackToken}`;
};

// ─── initiate STK push ───────────────────────────────────────

const initiateStkPush = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId } = req.params;
  const { phone, amount, referenceType, referenceId, productKey } = req.body;

  try {
    // Lookup the org's config to get the callback token
    const config = await prisma.kxMpesaConfig.findUnique({
      where: { organizationId },
      select: { callbackToken: true, isActive: true },
    });
    if (!config || !config.isActive) {
      return res.status(400).json({ error: 'M-Pesa is not configured for this organization' });
    }

    const callbackUrl = buildCallbackUrl(config.callbackToken);

    const result = await mpesaStkService.initiateStkPush({
      organizationId,
      phone,
      amount: Number(amount),
      referenceType,
      referenceId,
      productKey,
      callbackUrl,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.message.includes('Phone') ||
      error.message.includes('amount') ||
      error.message.includes('required')
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('not configured') || error.message.includes('decrypted')) {
      return res.status(400).json({ error: 'M-Pesa is not configured correctly for this organization' });
    }
    console.error('STK push error:', error);
    return res.status(500).json({
      error: 'Failed to initiate M-Pesa payment',
      reason: error.daraja?.errorMessage || undefined,
    });
  }
};

// ─── poll transaction ────────────────────────────────────────

const getTransaction = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId, merchantRef } = req.params;

  try {
    const tx = await mpesaStkService.getTransactionByMerchantRef(organizationId, merchantRef);
    return res.status(200).json({ transaction: tx });
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get transaction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── callback from Safaricom (UNAUTHENTICATED — token gates access) ───

const handleCallback = async (req, res) => {
  const { token } = req.params;

  try {
    // Resolve which org this callback belongs to
    const config = await prisma.kxMpesaConfig.findUnique({
      where: { callbackToken: token },
      select: { organizationId: true },
    });
    if (!config) {
      // Unknown token — return 200 to stop Safaricom retries, but log it
      console.warn('STK callback received with unknown token');
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // Process
    const result = await mpesaCallbackService.processCallback({
      organizationId: config.organizationId,
      payload: req.body,
    });

    console.log('[mpesa callback]', {
      organizationId: config.organizationId,
      merchantRef: result.merchantRef,
      status: result.status,
    });

    // Always return 200 quickly — Safaricom retries otherwise
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback handling error:', err);
    // Still 200 to prevent retries — we logged it
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

export default {
  initiateStkPush,
  getTransaction,
  handleCallback,
};