// src/modules/platform/email/templates/org.templates.js

import { BRAND } from '../utils/brand.js';
import { esc } from '../utils/html.js';
import { buildEmailShell, button, note, fallbackUrl, p } from './layout.js';

export const invitationEmail = ({ organizationName, inviterName, url }) => ({
  subject: `${inviterName} invited you to join ${organizationName}`,
  html: buildEmailShell({
    title: `Join ${organizationName}`,
    preheader: `${inviterName} invited you to join ${organizationName} on ${BRAND.name}.`,
    bodyHtml: `
      ${p('Hi there,')}
      ${p(`<strong>${esc(inviterName)}</strong> invited you to join <strong>${esc(organizationName)}</strong> on ${BRAND.name}.`)}
      ${button(url, 'Accept invitation')}
      ${note('warning', 'This invitation expires in 7 days.')}
      ${fallbackUrl(url)}
    `,
  }),
});