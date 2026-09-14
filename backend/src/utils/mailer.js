const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Transactional email sender, configured via SMTP env vars. Works with any
 * SMTP provider (school Gmail Workspace, Outlook 365, cPanel hosting mail,
 * SendGrid/Mailgun SMTP relay, etc.) — no vendor lock-in required.
 *
 * If SMTP isn't configured (e.g. local dev, or production before the
 * school's mail account is set up), sending is skipped and a warning is
 * logged instead of throwing — callers must not let email delivery block
 * or fail the underlying request (see auth.controller.forgotPassword,
 * which must behave identically whether or not the account exists).
 */
let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email. Never throws — logs and returns false on failure so a
 * mail-provider outage can't turn into a 500 for the user.
 */
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[mailer] SMTP not configured — skipped email to ${to} ("${subject}"). Set SMTP_HOST/SMTP_USER/SMTP_PASS to enable delivery.`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    logger.error('[mailer] Failed to send email', { to, subject, error: err.message });
    return false;
  }
}

async function sendPasswordResetEmail({ to, resetToken }) {
  const baseUrl = process.env.FRONTEND_URL || '';
  const resetLink = `${baseUrl.replace(/\/$/, '')}/portal/reset-password.html?token=${resetToken}`;

  return sendMail({
    to,
    subject: 'Darul Aman Academy — Password Reset Request',
    text: `A password reset was requested for your account. If this was you, use the link below (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <p>A password reset was requested for your Darul Aman Academy portal account.</p>
      <p>If this was you, click the link below to choose a new password (valid for 1 hour):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can safely ignore this email — your password will not change.</p>
    `,
  });
}

module.exports = { sendMail, sendPasswordResetEmail, isConfigured };
