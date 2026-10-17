// src/modules/platform/email/templates/org.templates.js

import { BRAND } from '../utils/brand.js';
import { esc } from '../utils/html.js';
import { buildEmailShell, button, note, fallbackUrl, p } from './layout.js';

export const invitationEmail = ({ organizationName, inviterName, url }) => {
  const inviter = inviterName || 'A teammate';
  const organization = organizationName || 'the organization';

  return {
    subject: `${inviter} invited you to join ${organization}`,
    html: buildEmailShell({
      title: `Join ${organization}`,
      preheader: `${inviter} invited you to join ${organization} on ${BRAND.name}.`,
      bodyHtml: `
        ${p('Hi there,')}
        ${p(`<strong>${esc(inviter)}</strong> invited you to join <strong>${esc(organization)}</strong> on ${BRAND.name}.`)}
        ${button(url, 'Accept invitation')}
        ${note('warning', 'This invitation expires in 7 days.')}
        ${fallbackUrl(url)}
      `,
    }),
  };
};