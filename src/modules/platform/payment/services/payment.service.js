// src/modules/platform/payment/services/payment.service.js

import crypto from 'crypto';
import paymentDb from '../db/payment.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';
import notifications from '../../notifications/index.js';
import pesapalService from './pesapal.service.js';

// ========================
// ENCRYPTION HELPERS
// ========================

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const getKey = () => {
  return Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
};

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// ========================
// Merchant Configuration
// ========================

const configureMerchant = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can configure payment settings');
  }

  const existing = await paymentDb.findConfigByOrgId(organizationId);
  let config;

  if (existing) {
    config = await paymentDb.updateConfig(organizationId, {
      environment: data.environment.toUpperCase(),
      consumerKey: data.consumerKey,
      consumerSecret: encrypt(data.consumerSecret),
      isActive: true,
      lastTestedAt: new Date(),
    });
  } else {
    config = await paymentDb.createConfig({
      organizationId,
      environment: data.environment.toUpperCase(),
      consumerKey: data.consumerKey,
      consumerSecret: encrypt(data.consumerSecret),
      isActive: true,
    });
  }

  // ✅ Automatically register IPN URL
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const ipnUrl = `${baseUrl}/api/v1/payment/webhook/ipn`;
    
    // Check if IPN already registered
    const existingIpn = await paymentDb.findIpnRegistrationByOrg(organizationId);
    if (!existingIpn) {
      const authService = new pesapalService.PesapalAuthService(
        config.environment,
        config.consumerKey,
        decrypt(config.consumerSecret)
      );
      
      const result = await pesapalService.registerIPN(authService, ipnUrl, 'POST');
      
      await paymentDb.createIpnRegistration({
        organizationId,
        ipnId: result.ipn_id,
        url: result.url,
        notificationType: result.ipn_notification_type_description || 'POST',
        isActive: result.ipn_status === 1,
      });
      
      console.log(`✅ IPN automatically registered for organization ${organizationId}`);
    }
  } catch (error) {
    console.error('Failed to auto-register IPN:', error.message);
    // Don't fail the config if IPN registration fails
  }

  await audit.log({
    organizationId,
    userId,
    action: 'PAYMENT_CONFIGURED',
    resource: 'payment_config',
    resourceId: config.id,
    metadata: {
      environment: data.environment,
    },
  });

  return config;
};

const getMerchantConfig = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const config = await paymentDb.findConfigByOrgId(organizationId);
  if (!config) {
    throw new Error('Payment configuration not found');
  }

  const { consumerSecret, ...safeConfig } = config;
  return safeConfig;
};

const isConfigured = async (organizationId) => {
  const config = await paymentDb.findConfigByOrgId(organizationId);
  return !!config && config.isActive;
};

// ========================
// IPN Registration
// ========================

const registerIPNURL = async (userId, organizationId, url, notificationType = 'POST') => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can register IPN URLs');
  }

  const config = await paymentDb.findConfigByOrgId(organizationId);
  if (!config) {
    throw new Error('Payment configuration not found. Please configure Pesapal first.');
  }

  const authService = new pesapalService.PesapalAuthService(
    config.environment,
    config.consumerKey,
    decrypt(config.consumerSecret)
  );

  const result = await pesapalService.registerIPN(authService, url, notificationType);

  const ipnRecord = await paymentDb.createIpnRegistration({
    organizationId,
    ipnId: result.ipn_id,
    url: result.url,
    notificationType: result.ipn_notification_type_description || notificationType,
    isActive: result.ipn_status === 1,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'PAYMENT_IPN_REGISTERED',
    resource: 'payment_ipn',
    resourceId: ipnRecord.id,
    metadata: { url, notificationType },
  });

  return ipnRecord;
};

// ========================
// Initiate Payment
// ========================

const initiatePayment = async (
  userId,
  organizationId,
  productId,
  productReference,
  data
) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const config = await paymentDb.findConfigByOrgId(organizationId);
  if (!config || !config.isActive) {
    throw new Error('Payment not configured for this organization');
  }

  const ipnRecord = await paymentDb.findIpnRegistrationByOrg(organizationId);
  if (!ipnRecord) {
    throw new Error('IPN URL not registered. Please register an IPN URL first.');
  }

  const merchantReference = `${productId.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const orderPayload = {
    id: merchantReference,
    currency: data.currency || 'KES',
    amount: data.amount,
    description: data.description || `${productId} payment`,
    callback_url: data.callbackUrl || `${process.env.BASE_URL}/api/v1/payment/callback`,
    cancellation_url: data.cancellationUrl || `${process.env.BASE_URL}/api/v1/payment/cancel`,
    notification_id: ipnRecord.ipnId,
    branch: data.branch || '',
    billing_address: {
      email_address: data.billingAddress?.email || '',
      phone_number: data.billingAddress?.phone || '',
      country_code: data.billingAddress?.country || 'KE',
      first_name: data.billingAddress?.firstName || '',
      middle_name: data.billingAddress?.middleName || '',
      last_name: data.billingAddress?.lastName || '',
      line_1: data.billingAddress?.line1 || '',
      line_2: data.billingAddress?.line2 || '',
      city: data.billingAddress?.city || '',
      state: data.billingAddress?.state || '',
      postal_code: data.billingAddress?.postalCode || '',
      zip_code: data.billingAddress?.zipCode || '',
    },
  };

  const authService = new pesapalService.PesapalAuthService(
    config.environment,
    config.consumerKey,
    decrypt(config.consumerSecret)
  );

  const result = await pesapalService.submitOrder(authService, orderPayload);

  const transaction = await paymentDb.createTransaction({
    organizationId,
    productId,
    productReference,
    merchantReference,
    orderTrackingId: result.order_tracking_id,
    amount: data.amount,
    currency: data.currency || 'KES',
    description: data.description || `${productId} payment`,
    status: 'PENDING',
    redirectUrl: result.redirect_url,
    callbackUrl: data.callbackUrl,
    cancellationUrl: data.cancellationUrl,
    notificationId: ipnRecord.ipnId,
    branch: data.branch,
    billingEmail: data.billingAddress?.email,
    billingPhone: data.billingAddress?.phone,
    billingFirstName: data.billingAddress?.firstName,
    billingLastName: data.billingAddress?.lastName,
    billingCountry: data.billingAddress?.country,
    billingLine1: data.billingAddress?.line1,
    billingCity: data.billingAddress?.city,
    billingState: data.billingAddress?.state,
    metadata: data.metadata || {},
  });

  await audit.log({
    organizationId,
    userId,
    action: 'PAYMENT_INITIATED',
    resource: 'payment_transaction',
    resourceId: transaction.id,
    metadata: {
      amount: data.amount,
      currency: data.currency,
      productId,
      productReference,
      merchantReference,
    },
  });

  return {
    transactionId: transaction.id,
    merchantReference,
    orderTrackingId: result.order_tracking_id,
    redirectUrl: result.redirect_url,
  };
};

// ========================
// Transaction Status
// ========================

const getTransactionByOrderTrackingId = async (organizationId, userId, orderTrackingId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const config = await paymentDb.findConfigByOrgId(organizationId);
  if (!config) {
    throw new Error('Payment configuration not found');
  }

  const transaction = await paymentDb.findTransactionByOrderTrackingId(orderTrackingId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const authService = new pesapalService.PesapalAuthService(
    config.environment,
    config.consumerKey,
    decrypt(config.consumerSecret)
  );

  const status = await pesapalService.getTransactionStatus(authService, orderTrackingId);

  await paymentDb.updateTransaction(transaction.id, {
    statusCode: status.status_code,
    statusDescription: status.payment_status_description,
    paymentMethod: status.payment_method,
    paymentAccount: status.payment_account,
    confirmationCode: status.confirmation_code,
    createdDate: status.created_date ? new Date(status.created_date) : undefined,
    completedAt: status.status_code === 1 ? new Date() : undefined,
    status: status.status_code === 1 ? 'COMPLETED' :
            status.status_code === 2 ? 'FAILED' :
            status.status_code === 3 ? 'REVERSED' : 'PENDING',
  });

  return {
    ...transaction,
    pesapal: status,
  };
};

// ========================
// Webhook / IPN Handling
// ========================

const handleIPN = async (payload) => {
  const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = payload;

  if (!OrderTrackingId) {
    throw new Error('OrderTrackingId is required');
  }

  const transaction = await paymentDb.findTransactionByOrderTrackingId(OrderTrackingId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  await paymentDb.updateTransaction(transaction.id, {
    ipnReceived: true,
    ipnPayload: payload,
  });

  const config = await paymentDb.findConfigByOrgId(transaction.organizationId);
  if (!config) {
    throw new Error('Payment configuration not found');
  }

  const authService = new pesapalService.PesapalAuthService(
    config.environment,
    config.consumerKey,
    decrypt(config.consumerSecret)
  );

  const status = await pesapalService.getTransactionStatus(authService, OrderTrackingId);

  await paymentDb.updateTransaction(transaction.id, {
    statusCode: status.status_code,
    statusDescription: status.payment_status_description,
    paymentMethod: status.payment_method,
    paymentAccount: status.payment_account,
    confirmationCode: status.confirmation_code,
    createdDate: status.created_date ? new Date(status.created_date) : undefined,
    completedAt: status.status_code === 1 ? new Date() : undefined,
    status: status.status_code === 1 ? 'COMPLETED' :
            status.status_code === 2 ? 'FAILED' :
            status.status_code === 3 ? 'REVERSED' : 'PENDING',
  });

  await audit.log({
    organizationId: transaction.organizationId,
    action: 'PAYMENT_IPN_RECEIVED',
    resource: 'payment_transaction',
    resourceId: transaction.id,
    metadata: {
      orderTrackingId: OrderTrackingId,
      status: status.status_code,
      notificationType: OrderNotificationType,
    },
  });

  // ✅ Trigger subscription update if payment succeeded
  if (status.status_code === 1 && transaction.productId) {
    try {
      const { default: subscriptionService } = await import('../../subscriptions/index.js');
      await subscriptionService.handleSubscriptionPaymentSuccess(
        transaction.organizationId,
        transaction.productId,
        transaction.id
      );
      console.log(`✅ Subscription updated for ${transaction.productId}`);
    } catch (error) {
      console.error('Failed to update subscription:', error.message);
    }
  }

  return {
    orderNotificationType: OrderNotificationType || 'IPNCHANGE',
    orderTrackingId: OrderTrackingId,
    orderMerchantReference: OrderMerchantReference || transaction.merchantReference,
    status: 200,
  };
};

// ========================
// Exports
// ========================

export default {
  configureMerchant,
  getMerchantConfig,
  isConfigured,
  registerIPNURL,
  initiatePayment,
  getTransactionByOrderTrackingId,
  handleIPN,
};