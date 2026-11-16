import type { EmailMessage } from "../lib/mailer.js";
import { escapeHtml } from "./appointment-emails.js";

export type PasswordResetEmailData = {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export function passwordResetEmail(data: PasswordResetEmailData): EmailMessage {
  const button =
    `<a href="${escapeHtml(data.resetUrl)}" style="display:inline-block;background:#0f766e;color:#fff;` +
    `padding:10px 18px;border-radius:8px;text-decoration:none">Criar nova senha</a>`;

  return {
    to: data.to,
    subject: "Redefinir sua senha do Lembrai",
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;max-width:560px;margin:0 auto;padding:24px">
    <p>Olá, ${escapeHtml(data.name)}!</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, clique no botão abaixo:</p>
    <p>${button}</p>
    <p>O link vale por ${data.expiresInMinutes} minutos e só pode ser usado uma vez.</p>
    <p style="color:#666">Não foi você? Pode ignorar este e-mail: sua senha continua a mesma.</p>
  </body>
</html>`,
    text: [
      `Olá, ${data.name}!`,
      "",
      "Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, abra o link:",
      data.resetUrl,
      "",
      `O link vale por ${data.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      "Não foi você? Pode ignorar este e-mail: sua senha continua a mesma.",
    ].join("\n"),
  };
}
