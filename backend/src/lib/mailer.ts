import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Nos testes, o jsonTransport só monta a mensagem em memória: nada é enviado de verdade.
const transport =
  env.NODE_ENV === "test"
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });

// Exportado como objeto (e não função solta) para os testes poderem espiar/simular falhas com vi.spyOn.
export const mailer = {
  async send(message: EmailMessage) {
    await transport.sendMail({ from: env.EMAIL_FROM, ...message });
  },
};
