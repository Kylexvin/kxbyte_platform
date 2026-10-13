// src/modules/platform/email/templates/layout.js
//
// Table-based layout with inline styles for Gmail/Outlook compatibility.
// Every dynamic value that reaches this file must already be escaped,
// except `title`, `preheader`, `productName` and `footerNote`, which are escaped here.

import { BRAND, COLORS } from '../utils/brand.js';
import { esc } from '../utils/html.js';

export const buildEmailShell = ({
  accent = COLORS.accent,
  productName = '',
  title,
  bodyHtml,
  preheader = '',
  footerNote = `You received this email because of activity on your ${BRAND.name} account.`,
}) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${COLORS.paper}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${COLORS.ink}; -webkit-font-smoothing:antialiased;">

  <span style="display:none; font-size:1px; color:${COLORS.paper}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${esc(preheader)}</span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background-color:${COLORS.surface}; border:1px solid ${COLORS.border}; border-radius:14px; overflow:hidden;">

          <!-- Accent bar -->
          <tr>
            <td style="padding:0; height:4px; line-height:4px; font-size:0; background-color:${accent};">&nbsp;</td>
          </tr>

          <!-- Brand row -->
          <tr>
            <td style="padding:24px 32px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="${BRAND.logoUrl}" alt="${BRAND.name}" width="132" style="display:block; width:132px; max-width:132px; height:auto; border:0; outline:none; text-decoration:none;" />
                  </td>
                  ${productName ? `
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block; font-size:12px; font-weight:600; color:${COLORS.inkMuted}; border:1px solid ${COLORS.border}; border-radius:99px; padding:3px 10px;">${esc(productName)}</span>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:22px 32px 4px;">
              <h1 style="margin:0; font-size:26px; line-height:1.25; font-weight:800; letter-spacing:-0.4px; color:${COLORS.ink};">${esc(title)}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:14px 32px 30px; font-size:15px; line-height:1.65; color:${COLORS.ink};">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px 26px; background-color:${COLORS.raised}; border-top:1px solid ${COLORS.border}; font-size:12px; line-height:1.7; color:${COLORS.inkFaint};">
              <div style="font-weight:600; color:${COLORS.inkMuted}; margin:0 0 6px;">${BRAND.products}</div>
              ${BRAND.name}, ${BRAND.location}<br />
              ${esc(footerNote)}<br />
              Need help? <a href="mailto:${BRAND.supportEmail}" style="color:${COLORS.inkMuted}; font-weight:600;">${BRAND.supportEmail}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ------------------------------------------------------------
// Components
// ------------------------------------------------------------

export const p = (html, style = '') =>
  `<p style="margin:0 0 16px; ${style}">${html}</p>`;

export const greeting = (firstName) =>
  p(`Hi <strong>${esc(firstName || 'there')}</strong>,`);

export const button = (href, label, accent = COLORS.accent) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tr>
      <td align="center" bgcolor="${accent}" style="border-radius:8px;">
        <a href="${esc(href)}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:700; color:${COLORS.onAccent}; text-decoration:none; border-radius:8px; background-color:${accent};">${esc(label)}</a>
      </td>
    </tr>
  </table>`;

export const note = (variant, html) => {
  const map = {
    info:    { bg: COLORS.infoSoft,    border: COLORS.info,    text: '#0C5460' },
    success: { bg: COLORS.successSoft, border: COLORS.success, text: '#166534' },
    warning: { bg: COLORS.warningSoft, border: COLORS.warning, text: '#8A4A00' },
    danger:  { bg: COLORS.dangerSoft,  border: COLORS.danger,  text: '#991B1B' },
  };
  const c = map[variant] || map.info;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
    <tr>
      <td style="background-color:${c.bg}; border-left:3px solid ${c.border}; border-radius:6px; padding:12px 14px; font-size:13.5px; line-height:1.55; color:${c.text};">${html}</td>
    </tr>
  </table>`;
};

export const fallbackUrl = (url) => `
  <p style="margin:14px 0 0; font-family:'Courier New',Courier,monospace; font-size:11px; line-height:1.5; color:${COLORS.inkFaint}; word-break:break-all;">${esc(url)}</p>`;

/** Label/value rows, e.g. payment details. rows: [{ label, value }] */
export const detailsList = (rows) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 18px; border:1px solid ${COLORS.border}; border-radius:8px; background-color:${COLORS.raised};">
    ${rows
      .map(
        (r, i) => `
    <tr>
      <td style="padding:11px 14px; font-size:13px; color:${COLORS.inkMuted}; ${i ? `border-top:1px solid ${COLORS.border};` : ''}">${esc(r.label)}</td>
      <td align="right" style="padding:11px 14px; font-size:14px; font-weight:700; color:${COLORS.ink}; ${i ? `border-top:1px solid ${COLORS.border};` : ''}">${esc(r.value)}</td>
    </tr>`
      )
      .join('')}
  </table>`;