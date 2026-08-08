// src/modules/platform/payment/controllers/payment.controller.js

import paymentService from '../services/payment.service.js';
import paymentValidator from '../validators/payment.validator.js';

// ========================
// Merchant Configuration
// ========================

const configureMerchant = async (req, res) => {
  const validation = paymentValidator.validateMerchantConfig(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await paymentService.configureMerchant(userId, organizationId, req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can configure payment settings') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Configure merchant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMerchantConfig = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await paymentService.getMerchantConfig(organizationId, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Payment configuration not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get merchant config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ========================
// IPN Registration
// ========================

const registerIPN = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { url, notificationType = 'POST' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await paymentService.registerIPNURL(userId, organizationId, url, notificationType);
    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can register IPN URLs') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Payment configuration not found. Please configure Pesapal first.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Register IPN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ========================
// Initiate Payment
// ========================

const initiatePayment = async (req, res) => {
  const validation = paymentValidator.validateInitiatePayment(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { productId, productReference, ...data } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const result = await paymentService.initiatePayment(
      userId,
      organizationId,
      productId,
      productReference,
      data
    );

    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Payment not configured for this organization') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'IPN URL not registered. Please register an IPN URL first.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Initiate payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ========================
// Transaction Status
// ========================

const getTransactionStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, orderTrackingId } = req.params;

    const result = await paymentService.getTransactionByOrderTrackingId(
      organizationId,
      userId,
      orderTrackingId
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Payment configuration not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Transaction not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get transaction status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ========================
// Webhook / IPN (No Auth)
// ========================

const handleIPN = async (req, res) => {
  try {
    const payload = req.method === 'GET' ? req.query : req.body;

    console.log('IPN received:', payload);

    const result = await paymentService.handleIPN(payload);

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'OrderTrackingId is required') {
      return res.status(400).json({ status: 500, message: 'Missing OrderTrackingId' });
    }
    if (error.message === 'Transaction not found') {
      return res.status(404).json({ status: 500, message: 'Transaction not found' });
    }
    console.error('IPN handling error:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
    });
  }
};


export default {
  configureMerchant,
  getMerchantConfig,
  registerIPN,
  initiatePayment,
  getTransactionStatus,
  handleIPN, 
};