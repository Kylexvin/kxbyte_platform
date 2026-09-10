// src/modules/platform/identity/email/email.service.js

import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY missing in .env');
} else {
  console.log('Resend API Key loaded');
}

// ============================================================
// BRAND
// ============================================================
const BRAND = {
  name: 'KXBYTE',
  productName: 'KxTill',
  logoUrl: 'https://res.cloudinary.com/dkahrnjrn/image/upload/v1788695499/logo.png',
  supportEmail: 'support@kxbyte.co.ke',
  websiteUrl: 'https://kxbyte.co.ke',
};

const COLORS = {
  // KxTill palette
  ink: '#1B1C23',
  inkMuted: '#62636E',
  inkFaint: '#9CA3AF',

  paper: '#F5F5F7',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  accent: '#FF6A2B',
  accentSoft: '#FFF1EA',
  accentDark: '#E85A1F',

  success: '#34C759',
  successSoft: '#E9F9EE',

  warning: '#FF9500',
  warningSoft: '#FFF4E5',

  danger: '#EF5350',
  dangerSoft: '#FDECEB',

  info: '#5AC8FA',
  infoSoft: '#EAF6FD',
};

// ============================================================
// EMAIL SHELL
// ============================================================
// Table-based layout for maximum email-client compatibility.
// Inline styles everywhere so Gmail/Outlook don't strip anything.
// ============================================================

const buildEmailShell = ({
  accent = COLORS.accent,
  eyebrow,
  title,
  bodyHtml,
  preheader = '',
  hideFooter = false,
}) => {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${COLORS.paper}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:${COLORS.ink}; -webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden preview text) -->
  <span style="display:none; font-size:1px; color:${COLORS.paper}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:540px; background-color:${COLORS.surface}; border:1px solid ${COLORS.border}; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.05);">

          <!-- Brand bar -->
          <tr>
            <td style="padding:24px 28px 20px; border-bottom:1px solid ${COLORS.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img
                      src="${BRAND.logoUrl}"
                      alt="${BRAND.name}"
                      width="140"
                      height="auto"
                      style="display:block; max-width:140px; height:auto; border:0; outline:none; text-decoration:none;"
                    />
                  </td>
                  <td align="right" style="vertical-align:middle; font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:${COLORS.inkFaint};">
                    ${BRAND.productName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent strip -->
          <tr>
            <td style="padding:0; height:3px; line-height:3px; font-size:0; background-color:${accent};">&nbsp;</td>
          </tr>

          <!-- Header (eyebrow + title) -->
          <tr>
            <td style="padding:28px 28px 8px;">
              ${eyebrow ? `
                <div style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:${accent}; background-color:${COLORS.accentSoft}; border-radius:4px; padding:4px 10px; margin:0 0 14px;">
                  ${eyebrow}
                </div>
              ` : ''}
              <h1 style="margin:0; font-size:24px; line-height:1.25; font-weight:800; color:${COLORS.ink}; letter-spacing:-0.3px;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 28px 8px; font-size:15px; line-height:1.65; color:${COLORS.ink};">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          ${hideFooter ? '' : `
          <tr>
            <td style="padding:20px 28px 26px; border-top:1px solid ${COLORS.border}; font-size:12px; line-height:1.6; color:${COLORS.inkMuted}; text-align:center;">
              <p style="margin:0 0 6px; font-weight:700; color:${COLORS.ink};">
                &mdash; The ${BRAND.name} Team
              </p>
              <p style="margin:0 0 6px;">
                Need help?
                <a href="mailto:${BRAND.supportEmail}" style="color:${accent}; text-decoration:none; font-weight:600;">${BRAND.supportEmail}</a>
              </p>
              <p style="margin:0; font-size:11px; color:${COLORS.inkFaint};">
                &copy; ${year} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>
          `}

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
};

// ============================================================
// HELPERS
// ============================================================

const button = (href, label, accent = COLORS.accent) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
    <tr>
      <td align="center" bgcolor="${accent}" style="border-radius:8px;">
        <a
          href="${href}"
          target="_blank"
          style="display:inline-block; padding:14px 28px; font-family:inherit; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:8px; background-color:${accent};"
        >
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const note = (variant, content) => {
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
        <td style="background-color:${c.bg}; border-left:3px solid ${c.border}; border-radius:6px; padding:12px 14px; font-size:13.5px; line-height:1.55; color:${c.text};">
          ${content}
        </td>
      </tr>
    </table>
  `;
};

const fallbackUrl = (url) => `
  <p style="margin:14px 0 0; font-family:'Courier New', Courier, monospace; font-size:11px; line-height:1.5; color:${COLORS.inkFaint}; word-break:break-all;">
    ${url}
  </p>
`;

// ============================================================
// SEND
// ============================================================

const sendEmail = async ({ to, from, subject, html, replyTo }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: from || `${BRAND.name} <no-reply@kxbyte.co.ke>`,
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

// ============================================================
// TEMPLATES
// ============================================================

export const sendVerificationEmail = async (email, token, firstName) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 8px;">
      Welcome to ${BRAND.name}. Verify your email address to finish setting up your account.
    </p>
    ${button(verificationUrl, 'Verify my email')}
    ${note('warning', 'This link expires in 24 hours.')}
    ${fallbackUrl(verificationUrl)}
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Welcome',
    title: 'Verify your email',
    preheader: `Verify your email to finish setting up your ${BRAND.name} account.`,
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: `Verify your ${BRAND.name} account`,
    html,
  });

  if (result.success) {
    console.log(`Verification email sent to: ${email}`);
  } else {
    console.log(`Verification link (email failed): ${verificationUrl}`);
  }

  return result;
};

export const sendPasswordResetEmail = async (email, token, firstName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 8px;">
      We received a request to reset your ${BRAND.name} account password.
    </p>
    ${button(resetUrl, 'Reset my password')}
    ${note('warning', "This link expires in 1 hour. If you didn't request this, ignore this email — your password won't change.")}
    ${fallbackUrl(resetUrl)}
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Security',
    title: 'Reset your password',
    preheader: `Reset your ${BRAND.name} password — this link expires in 1 hour.`,
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: `Reset your ${BRAND.name} password`,
    html,
  });

  if (result.success) {
    console.log(`Password reset email sent to: ${email}`);
  } else {
    console.log(`Password reset link (email failed): ${resetUrl}`);
  }

  return result;
};

export const sendPasswordResetConfirmation = async (email, firstName) => {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi <strong>${firstName || 'there'}</strong>,</p>
    ${note('success', `Your ${BRAND.name} account password has been changed successfully.`)}
    ${note('danger', "If you didn't make this change, contact support immediately.")}
  `;

  const html = buildEmailShell({
    accent: COLORS.success,
    eyebrow: 'Security',
    title: 'Password changed',
    preheader: `Your ${BRAND.name} password has been changed.`,
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject: `Your ${BRAND.name} password has been changed`,
    html,
  });
};

export const sendInvitationEmail = async (email, token, organizationName, inviterName) => {
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${token}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi there,</p>
    <p style="margin:0 0 8px;">
      <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${BRAND.name}.
    </p>
    ${button(inviteUrl, 'Accept Invitation')}
    ${note('warning', 'This invitation expires in 7 days.')}
    ${fallbackUrl(inviteUrl)}
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Invitation',
    title: 'Join an organization',
    preheader: `You've been invited to join ${organizationName} on ${BRAND.name}.`,
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: `Invitation to join ${organizationName}`,
    html,
  });

  if (result.success) {
    console.log(`Invitation email sent to: ${email}`);
  } else {
    console.log(`Invitation link (email failed): ${inviteUrl}`);
  }

  return result;
};

export const sendNotificationEmail = async (email, title, message, metadata = {}) => {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi there,</p>
    <p style="margin:0 0 8px;">${message}</p>
    ${metadata.link ? button(metadata.link, metadata.buttonText || 'View Details') : ''}
    ${note('info', `This is an automated notification from ${BRAND.name}.`)}
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Notification',
    title,
    preheader: message.substring(0, 100),
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: title,
    html,
  });

  if (result.success) {
    console.log(`Notification email sent to: ${email}`);
  } else {
    console.log(`Notification email failed: ${email}`);
  }

  return result;
};

export default sendEmail;