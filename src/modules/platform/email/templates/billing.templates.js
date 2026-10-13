// src/modules/platform/email/templates/billing.templates.js
//
// Billing emails take plain data. The email module never imports from
// products/*, so the caller (e.g. KxTill billing) passes `payment` in.
//
// payment: { displayAmount, paybill, accountNumber, contactEmail }

import { COLORS } from '../utils/brand.js';
import { esc, formatDate } from '../utils/html.js';
import { buildEmailShell, button, detailsList, greeting, note, p } from './layout.js';

const payBlock = (payment) => {
  if (!payment) return '';
  return `
    ${p('<strong>Pay with M-Pesa</strong>', 'margin-bottom:6px;')}
    ${detailsList([
      { label: 'Amount', value: payment.displayAmount },
      { label: 'Paybill number', value: payment.paybill },
      { label: 'Account number', value: payment.accountNumber },
    ])}
    ${p(
      `After paying, email the M-Pesa confirmation code to <strong>${esc(payment.contactEmail)}</strong>. We activate your subscription within 24 hours.`,
      `font-size:13px; color:${COLORS.inkMuted};`
    )}`;
};

export const trialEndingEmail = ({
  firstName,
  organizationName,
  productName = 'KxTill',
  endsAt,
  graceDays = 2,
  payment,
  url,
}) => ({
  subject: `Your ${productName} trial ends on ${formatDate(endsAt)}`,
  html: buildEmailShell({
    productName,
    title: `Your trial ends on ${formatDate(endsAt)}`,
    preheader: `Subscribe to keep selling with ${productName}.`,
    bodyHtml: `
      ${greeting(firstName)}
      ${p(`The free trial for <strong>${esc(organizationName)}</strong> ends on <strong>${formatDate(endsAt)}</strong>.`)}
      ${p(`After that you get ${graceDays} days of read-only access, so you can still view sales, stock and reports but can't record new sales. Subscribe before then to keep everything running.`)}
      ${payBlock(payment)}
      ${url ? button(url, 'View billing') : ''}
    `,
  }),
});

export const gracePeriodEmail = ({
  firstName,
  organizationName,
  productName = 'KxTill',
  graceEndsAt,
  payment,
  url,
}) => ({
  subject: `${productName} is now read-only for ${organizationName}`,
  html: buildEmailShell({
    productName,
    accent: COLORS.warning,
    title: 'Your account is now read-only',
    preheader: `Renew by ${formatDate(graceEndsAt)} to record sales again.`,
    bodyHtml: `
      ${greeting(firstName)}
      ${note('warning', `<strong>${esc(organizationName)}</strong> can't record new sales, change products or update stock until you renew. You can still view data and export reports until <strong>${formatDate(graceEndsAt)}</strong>.`)}
      ${payBlock(payment)}
      ${url ? button(url, 'View billing') : ''}
    `,
  }),
});

export const subscriptionExpiredEmail = ({
  firstName,
  organizationName,
  productName = 'KxTill',
  payment,
  url,
}) => ({
  subject: `${productName} subscription expired for ${organizationName}`,
  html: buildEmailShell({
    productName,
    accent: COLORS.danger,
    title: 'Your subscription has expired',
    preheader: 'Renew to restore full access.',
    bodyHtml: `
      ${greeting(firstName)}
      ${note('danger', `Point of Sale, inventory, customers and reports are locked for <strong>${esc(organizationName)}</strong>. Your data is safe and comes back as soon as you renew.`)}
      ${payBlock(payment)}
      ${url ? button(url, 'View billing') : ''}
    `,
  }),
});

export const paymentReceivedEmail = ({
  firstName,
  organizationName,
  productName = 'KxTill',
  amount,
  reference,
  periodEnd,
  url,
}) => ({
  subject: `Payment received for ${organizationName}`,
  html: buildEmailShell({
    productName,
    accent: COLORS.success,
    title: 'Payment received',
    preheader: `Your ${productName} subscription is active until ${formatDate(periodEnd)}.`,
    bodyHtml: `
      ${greeting(firstName)}
      ${p(`Thanks, we received your payment. <strong>${esc(organizationName)}</strong> has full access until <strong>${formatDate(periodEnd)}</strong>.`)}
      ${detailsList([
        { label: 'Amount', value: amount },
        ...(reference ? [{ label: 'Reference', value: reference }] : []),
        { label: 'Active until', value: formatDate(periodEnd) },
      ])}
      ${url ? button(url, 'View billing') : ''}
    `,
  }),
});