// src/modules/platform/email/templates/auth.templates.js

import { BRAND, COLORS } from '../utils/brand.js';
import { buildEmailShell, button, note, fallbackUrl, greeting, p } from './layout.js';

export const verificationEmail = ({ firstName, url }) => ({
  subject: `Verify your ${BRAND.name} account`,
  html: buildEmailShell({
    title: 'Confirm your email',
    preheader: `Confirm your email to finish setting up your ${BRAND.name} account.`,
    bodyHtml: `
      ${greeting(firstName)}
      ${p(`Welcome to ${BRAND.name}. Confirm your email address to finish setting up your account.`)}
      ${button(url, 'Verify my email')}
      ${note('warning', 'This link expires in 24 hours.')}
      ${fallbackUrl(url)}
    `,
  }),
});

export const passwordResetEmail = ({ firstName, url }) => ({
  subject: `Reset your ${BRAND.name} password`,
  html: buildEmailShell({
    title: 'Reset your password',
    preheader: 'This link expires in 1 hour.',
    bodyHtml: `
      ${greeting(firstName)}
      ${p(`We received a request to reset the password for your ${BRAND.name} account.`)}
      ${button(url, 'Choose a new password')}
      ${note('warning', "This link expires in 1 hour and works once. If you didn't ask for this, ignore this email and your password stays the same.")}
      ${fallbackUrl(url)}
    `,
  }),
});

export const passwordChangedEmail = ({ firstName }) => ({
  subject: `Your ${BRAND.name} password has been changed`,
  html: buildEmailShell({
    accent: COLORS.success,
    title: 'Password changed',
    preheader: `Your ${BRAND.name} password has been changed.`,
    bodyHtml: `
      ${greeting(firstName)}
      ${note('success', `Your ${BRAND.name} account password was changed successfully.`)}
      ${note('danger', `If you didn't make this change, email ${BRAND.supportEmail} straight away.`)}
    `,
  }),
});

export const welcomeEmail = ({ firstName, url }) => ({
  subject: `Welcome to ${BRAND.name}, ${firstName || 'there'}`,
  html: buildEmailShell({
    title: `Your account is ready${firstName ? `, ${firstName}` : ''}`,
    preheader: 'Set up your organization and activate your first product.',
    bodyHtml: `
      ${greeting(firstName)}
      ${p(`Your email is verified and your ${BRAND.name} account is ready.`)}
      ${p('Next, create or choose your organization, then activate a product from your dashboard. If you get stuck, reply to this email and a person will help.')}
      ${button(url, 'Open your dashboard')}
    `,
  }),
});