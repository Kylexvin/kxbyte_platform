// src/modules/platform/email/templates/notification.templates.js

import { BRAND } from '../utils/brand.js';
import { esc } from '../utils/html.js';
import { buildEmailShell, button, note, p } from './layout.js';

export const notificationEmail = ({ title, message, link, buttonText }) => ({
  subject: title,
  html: buildEmailShell({
    title,
    preheader: String(message || '').substring(0, 100),
    bodyHtml: `
      ${p('Hi there,')}
      ${p(esc(message).replace(/\n/g, '<br />'))}
      ${link ? button(link, buttonText || 'View details') : ''}
      ${note('info', `This is an automated notification from ${BRAND.name}.`)}
    `,
  }),
});