// src/modules/platform/email/services/email.service.js

import { Resend } from 'resend';
import { BRAND } from '../utils/brand.js';
import * as authTpl from '../templates/auth.templates.js';
import * as orgTpl from '../templates/org.templates.js';
import * as notificationTpl from '../templates/notification.templates.js';
import * as billingTpl from '../templates/billing.templates.js';
import * as productTpl from '../templates/product.templates.js';

// ============================================================
// TRANSPORT
// ============================================================

let client = null;

const getClient = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
};

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY missing in .env');
} else {
  console.log('Resend API Key loaded');
}

export const sendEmail = async ({ to, from, subject, html, replyTo }) => {
  const resend = getClient();
  if (!resend) return { success: false, error: 'RESEND_API_KEY missing' };

  try {
    const { data, error } = await resend.emails.send({
      from: from || `${BRAND.name} <${BRAND.fromAddress}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo: replyTo || BRAND.supportEmail,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

/** Render with a template, send, and log the outcome. */
const deliver = async (to, { subject, html }, { label, devLink } = {}) => {
  const result = await sendEmail({ to, subject, html });

  if (result.success) {
    console.log(`${label} email sent to: ${to}`);
  } else if (devLink && process.env.NODE_ENV !== 'production') {
    console.log(`${label} link (email failed): ${devLink}`);
  } else {
    console.log(`${label} email failed: ${to}`);
  }

  return result;
};

const authUrl = (path, token) =>
  `${process.env.AUTH_BASE_URL || 'http://localhost:5000'}/api/v1/auth/${path}?token=${token}`;

const appUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

// ============================================================
// AUTH
// ============================================================

export const sendVerificationEmail = (email, token, firstName) => {
  const url = authUrl('verify-email', token);
  return deliver(email, authTpl.verificationEmail({ firstName, url }), {
    label: 'Verification',
    devLink: url,
  });
};

export const sendPasswordResetEmail = (email, token, firstName) => {
  const url = authUrl('reset-password', token);
  return deliver(email, authTpl.passwordResetEmail({ firstName, url }), {
    label: 'Password reset',
    devLink: url,
  });
};

export const sendPasswordResetConfirmation = (email, firstName) =>
  deliver(email, authTpl.passwordChangedEmail({ firstName }), {
    label: 'Password changed',
  });

// ============================================================
// ORGANIZATIONS
// ============================================================

export const sendInvitationEmail = (email, token, organizationName, inviterName) => {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding/accept-invitation?token=${token}`;
  return deliver(email, orgTpl.invitationEmail({ organizationName, inviterName, url }), {
    label: 'Invitation',
    devLink: url,
  });
};

// ============================================================
// NOTIFICATIONS
// ============================================================

export const sendNotificationEmail = (email, title, message, metadata = {}) =>
  deliver(
    email,
    notificationTpl.notificationEmail({
      title,
      message,
      link: metadata.link,
      buttonText: metadata.buttonText,
    }),
    { label: 'Notification' }
  );

// ============================================================
// BILLING (data is passed in by the caller, e.g. KxTill)
// ============================================================

export const sendTrialEndingEmail = (email, data) =>
  deliver(email, billingTpl.trialEndingEmail(data), { label: 'Trial ending' });

export const sendGracePeriodEmail = (email, data) =>
  deliver(email, billingTpl.gracePeriodEmail(data), { label: 'Grace period' });

export const sendSubscriptionExpiredEmail = (email, data) =>
  deliver(email, billingTpl.subscriptionExpiredEmail(data), { label: 'Subscription expired' });

export const sendPaymentReceivedEmail = (email, data) =>
  deliver(email, billingTpl.paymentReceivedEmail(data), { label: 'Payment received' });

// ============================================================
// ONBOARDING
// ============================================================

export const sendWelcomeEmail = (email, firstName) =>
  deliver(email, authTpl.welcomeEmail({ firstName, url: appUrl() }), { label: 'Welcome' });

export const sendProductActivatedEmail = (email, data) =>
  deliver(
    email,
    productTpl.productActivatedEmail({ ...data, url: data.url || appUrl() }),
    { label: 'Product activated' }
  );