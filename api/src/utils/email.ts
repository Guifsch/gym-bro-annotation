import { env } from './env';

async function sendResendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`[email:dev-fallback] to=${params.to} subject="${params.subject}"\n${params.html}`);
    return;
  }

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
  return sendResendEmail({
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
  return sendResendEmail({
    to: email,
    subject: 'Recuperação de senha — Gym Bro',
    html: codeEmailHtml(
      'Redefinir sua senha',
      code,
      'Este código expira em alguns minutos. Se você não solicitou a redefinição, ignore este e-mail.'
    ),
  });
}
