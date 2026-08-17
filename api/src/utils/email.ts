import nodemailer, { type Transporter } from 'nodemailer';

import { env } from './env';

async function sendResendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.resendFromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${body}`);
  }
}

let gmailTransporter: Transporter | null = null;

function getGmailTransporter(): Transporter {
  gmailTransporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  });
  return gmailTransporter;
}

async function sendGmailEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  await getGmailTransporter().sendMail({
    // A bare address here falls back to whatever display name is set on the Gmail account's own
    // profile (could be anything the account owner typed in ages ago) — set it explicitly instead,
    // matching how RESEND_FROM_EMAIL already carries "Gym Bro <...>".
    from: `Gym Bro <${env.gmailUser}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

// Resend's sandbox sender (no verified domain) can only deliver to the account owner's own
// address — Gmail SMTP works for arbitrary recipients today. Switch back to 'resend' once a
// domain is verified there; EMAIL_PROVIDER picks which implementation actually sends.
async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const hasCredentials = env.emailProvider === 'gmail' ? env.gmailUser && env.gmailAppPassword : env.resendApiKey;
  if (!hasCredentials) {
    console.log(`[email:dev-fallback:${env.emailProvider}] to=${params.to} subject="${params.subject}"\n${params.html}`);
    return;
  }

  if (env.emailProvider === 'gmail') {
    await sendGmailEmail(params);
  } else {
    await sendResendEmail(params);
  }
}

function codeEmailHtml(heading: string, code: string, footer: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${heading}</h2>
      <div style="font-family: monospace; font-size: 28px; letter-spacing: 4px; background: #f0f0f3; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
        ${code}
      </div>
      <p style="color: #60646c; font-size: 14px;">${footer}</p>
    </div>
  `;
}

export function sendRegistrationCode(email: string, code: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: 'Seu código de confirmação — Gym Bro',
    html: codeEmailHtml(
      'Confirme seu cadastro',
      code,
      'Este código expira em alguns minutos. Se você não solicitou este cadastro, ignore este e-mail.'
    ),
  });
}

export function sendPasswordResetCode(email: string, code: string): Promise<void> {
  return sendEmail({
    to: email,
    subject: 'Recuperação de senha — Gym Bro',
    html: codeEmailHtml(
      'Redefinir sua senha',
      code,
      'Este código expira em alguns minutos. Se você não solicitou a redefinição, ignore este e-mail.'
    ),
  });
}
