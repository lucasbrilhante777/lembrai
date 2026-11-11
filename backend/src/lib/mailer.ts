import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Em dev, sem configuração, usa o Mailpit do docker-compose. Em produção, sem SMTP_HOST,
// o envio fica DESLIGADO: o sistema funciona normalmente, só não manda e-mails.
const smtpHost = env.SMTP_HOST ?? (env.NODE_ENV === "production" ? undefined : "localhost");

// jsonTransport só monta a mensagem em memória, sem enviar nada (testes, ou produção sem SMTP).
const transport =
  env.NODE_ENV === "test" || !smtpHost
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: smtpHost,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });

if (env.NODE_ENV === "production" && !smtpHost) {
  console.warn("⚠️  SMTP_HOST não configurado: o envio de e-mails está desligado.");
}

// Exportado como objeto (e não função solta) para os testes poderem espiar/simular falhas com vi.spyOn.
export const mailer = {
  async send(message: EmailMessage) {
    await transport.sendMail({ from: env.EMAIL_FROM, ...message });
  },
};
