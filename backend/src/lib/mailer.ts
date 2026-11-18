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

// Domínios reservados para exemplos e testes (RFC 2606 e RFC 6761): não existe caixa de e-mail neles.
// A conta demo usa @example.com. Mandar para lá só gera "bounce" (devolução), e muitos bounces
// fazem o provedor de e-mail (Brevo) achar que somos spammers e bloquear a conta.
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = [".example", ".test", ".invalid", ".localhost"];

export function isReservedAddress(email: string) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return RESERVED_DOMAINS.has(domain) || RESERVED_TLDS.some((tld) => domain.endsWith(tld));
}

// Em dev tudo vai para o Mailpit (dá para ver os e-mails da demo). Fora do dev, endereço reservado é pulado.
const skipReserved = env.NODE_ENV !== "development";

// Exportado como objeto (e não função solta) para os testes poderem espiar/simular falhas com vi.spyOn.
export const mailer = {
  async send(message: EmailMessage): Promise<"sent" | "skipped"> {
    if (skipReserved && isReservedAddress(message.to)) return "skipped";

    await transport.sendMail({ from: env.EMAIL_FROM, ...message });
    return "sent";
  },
};
