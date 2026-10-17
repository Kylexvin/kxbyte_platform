// src/modules/platform/email/templates/product.templates.js

import { esc, formatDate } from '../utils/html.js';
import { COLORS } from '../utils/brand.js';
import { buildEmailShell, button, detailsList, greeting, note, p } from './layout.js';

/**
 * Sent when an organization owner activates (or reactivates) a product.
 * subscriptionStatus: 'TRIAL' | 'ACTIVE' | anything else (treated as payment needed)
 */
export const productActivatedEmail = ({
  firstName,
  organizationName,
  productName,
  subscriptionStatus,
  trialEnd,
  remainingDays,
  url,
}) => {
  const org = organizationName || 'your organization';
  const onTrial = subscriptionStatus === 'TRIAL' && trialEnd;
  const isActive = subscriptionStatus === 'ACTIVE';

  const rows = [
    { label: 'Product', value: productName },
    { label: 'Organization', value: org },
  ];
  if (onTrial) rows.push({ label: 'Trial ends', value: formatDate(trialEnd) });

  let status;
  if (onTrial) {
    const days = Number.isFinite(remainingDays) ? ` (${remainingDays} days left)` : '';
    status = note('info', `Your free trial is running until <strong>${formatDate(trialEnd)}</strong>${days}. Subscribe before then to keep full access.`);
  } else if (isActive) {
    status = note('success', 'Your subscription is active and everything is unlocked.');
  } else {
    status = note('warning', 'The free trial for this product has already been used, so full access starts once your subscription is paid. Your data is kept in the meantime.');
  }

  return {
    subject: `${productName} is ready for ${org}`,
    html: buildEmailShell({
      productName,
      accent: onTrial || isActive ? COLORS.accent : COLORS.warning,
      title: onTrial ? 'Your free trial has started' : `${productName} is activated`,
      preheader: `${productName} is now set up for ${org}.`,
      bodyHtml: `
        ${greeting(firstName)}
        ${p(`<strong>${esc(productName)}</strong> is now activated for <strong>${esc(org)}</strong>.`)}
        ${detailsList(rows)}
        ${status}
        ${button(url, `Open ${productName}`)}
      `,
    }),
  };
};