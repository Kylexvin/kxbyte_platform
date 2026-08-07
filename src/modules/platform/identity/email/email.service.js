// src/modules/platform/identity/email/email.service.js

import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY missing in .env");
} else {
  console.log("Resend API Key loaded");
}

const COLORS = {
  ink: '#0A1628',
  paper: '#F5F7FA',
  paperLine: '#E2E8F0',
  accent: '#2563EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  white: '#FFFFFF',
};

const buildEmailShell = ({ accent = COLORS.accent, eyebrow, title, bodyHtml, preheader = '' }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin:0; padding:0; background-color:${COLORS.paper}; font-family: Arial, Helvetica, sans-serif; color:${COLORS.ink}; }
      table { border-collapse: collapse; }
      .wrapper { width:100%; background-color:${COLORS.paper}; padding:32px 16px; }
      .card { max-width:540px; margin:0 auto; background-color:${COLORS.white}; border:1px solid ${COLORS.paperLine}; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .header { padding:24px 28px; background-color:${accent}; }
      .eyebrow { display:inline-block; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#ffffff; background-color:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:3px; padding:4px 10px; margin:0 0 12px; }
      h1 { margin:0; font-size:22px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#ffffff; }
      .content { padding:28px; font-size:15px; line-height:1.65; }
      .content p { margin:0 0 16px; }
      .button { display:inline-block; background-color:${COLORS.accent}; color:#ffffff; text-decoration:none; font-weight:bold; font-size:15px; padding:14px 26px; border-radius:4px; }
      .note { border-radius:4px; padding:12px 14px; margin:18px 0; font-size:13.5px; border:1px solid; }
      .note-warning { background-color:#FEF3C7; border-color:${COLORS.warning}; color:#92400E; }
      .note-success { background-color:#DCFCE7; border-color:${COLORS.success}; color:#166534; }
      .note-danger { background-color:#FEE2E2; border-color:${COLORS.danger}; color:#991B1B; }
      .divider { border:none; border-top:1px solid ${COLORS.paperLine}; margin:22px 0; }
      .footer { padding:20px 28px 26px; font-size:12px; color:#6B7280; text-align:center; border-top:1px solid ${COLORS.paperLine}; }
      .footer a { color:${COLORS.accent}; text-decoration:none; }
      .url-fallback { word-break:break-all; font-family:'Courier New', Courier, monospace; font-size:11px; color:#6B7280; margin-top:14px; }
    </style>
  </head>
  <body>
    <span style="display:none; font-size:1px; color:${COLORS.paper}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          ${eyebrow ? `<span class="eyebrow">${eyebrow}</span><br/>` : ''}
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${bodyHtml}
        </div>
        <div class="footer">
          <p style="margin:0 0 6px; font-weight:bold; color:${COLORS.ink};">&mdash; The KXBYTE Team</p>
          <p style="margin:0;">Need help? <a href="mailto:support@kxbyte.com">support@kxbyte.com</a></p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

const sendEmail = async ({ to, from, subject, html, replyTo }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: from ||'KXBYTE <vinnykylex@gmail.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo: replyTo || 'support@kxbyte.com',
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

export const sendVerificationEmail = async (email, token, firstName) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const bodyHtml = `
    <p>Hi <strong>${firstName || 'there'}</strong>,</p>
    <p>Welcome to KXBYTE. Verify your email to get started:</p>
    <p style="text-align:center; margin:26px 0;">
      <a href="${verificationUrl}" class="button">Verify my email</a>
    </p>
    <div class="note note-warning">This link expires in 24 hours.</div>
    <p class="url-fallback">${verificationUrl}</p>
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Welcome',
    title: 'Verify your email',
    preheader: 'Verify your email to finish setting up your KXBYTE account.',
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: 'Verify your KXBYTE account',
    html,
  });

  if (result.success) {
    console.log(`✅ Verification email sent to: ${email}`);
  } else {
    console.log(`📧 Verification link (email failed): ${verificationUrl}`);
  }

  return result;
};

export const sendPasswordResetEmail = async (email, token, firstName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const bodyHtml = `
    <p>Hi <strong>${firstName || 'there'}</strong>,</p>
    <p>We received a request to reset your KXBYTE account password.</p>
    <p style="text-align:center; margin:26px 0;">
      <a href="${resetUrl}" class="button">Reset my password</a>
    </p>
    <div class="note note-warning">This link expires in 1 hour. If you didn't request this, ignore this email.</div>
    <p class="url-fallback">${resetUrl}</p>
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Security',
    title: 'Reset your password',
    preheader: 'Reset your KXBYTE password — this link expires in 1 hour.',
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: 'Reset your KXBYTE password',
    html,
  });

  if (result.success) {
    console.log(`✅ Password reset email sent to: ${email}`);
  } else {
    console.log(`📧 Password reset link (email failed): ${resetUrl}`);
  }

  return result;
};

export const sendPasswordResetConfirmation = async (email, firstName) => {
  const bodyHtml = `
    <p>Hi <strong>${firstName || 'there'}</strong>,</p>
    <div class="note note-success">Your KXBYTE account password has been changed successfully.</div>
    <div class="note note-danger">If you didn't make this change, contact support immediately.</div>
  `;

  const html = buildEmailShell({
    accent: COLORS.success,
    eyebrow: 'Security',
    title: 'Password changed',
    preheader: 'Your KXBYTE password has been changed.',
    bodyHtml,
  });

  return sendEmail({
    to: email,
    subject: 'Your KXBYTE password has been changed',
    html,
  });
};

export const sendInvitationEmail = async (email, token, organizationName, inviterName) => {
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${token}`;

  const bodyHtml = `
    <p>Hi there,</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on KXBYTE.</p>
    <p style="text-align:center; margin:26px 0;">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </p>
    <div class="note note-warning">This invitation expires in 7 days.</div>
    <p class="url-fallback">${inviteUrl}</p>
  `;

  const html = buildEmailShell({
    accent: COLORS.accent,
    eyebrow: 'Invitation',
    title: 'Join an organization',
    preheader: `You've been invited to join ${organizationName} on KXBYTE.`,
    bodyHtml,
  });

  const result = await sendEmail({
    to: email,
    subject: `Invitation to join ${organizationName}`,
    html,
  });

  if (result.success) {
    console.log(`✅ Invitation email sent to: ${email}`);
  } else {
    console.log(`📧 Invitation link (email failed): ${inviteUrl}`);
  }

  return result;
};
export default sendEmail;