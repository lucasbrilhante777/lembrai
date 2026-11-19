import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Nome que aparece no remetente. O endereço é sempre o de EMAIL_FROM (o único verificado no provedor). */
  fromName?: string;
  /** Para onde vai a resposta, se a pessoa clicar em "Responder". */
  replyTo?: string;
};

/**
 * Separa `Lembrai <contato@dominio.com>` em nome e endereço.
 * O nome pode mudar por e-mail; o endereço não: o provedor só aceita remetentes verificados
 * (e, com domínio próprio, o SPF/DKIM do domínio).
 */
export function parseFrom(value: string) {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match) return { name: match[1] || "Lembrai", address: match[2]! };
  return { name: "Lembrai", address: value.trim() };
}

const defaultFrom = parseFrom(env.EMAIL_FROM);

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
        // Os padrões do Nodemailer esperam até 2 minutos para conectar. Com a porta bloqueada
        // (plano grátis do Render bloqueia 25, 465 e 587), cada envio ficaria pendurado esse tempo todo.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
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

    const { fromName, ...rest } = message;
    // Nome e endereço em objeto (não montados numa string): o Nodemailer codifica o nome com segurança.
    // O nome vem do cadastro do estabelecimento; numa string, um nome com aspas, "<" ou quebra de
    // linha poderia bagunçar (ou injetar) cabeçalhos do e-mail.
    await transport.sendMail({ ...rest, from: { name: fromName ?? defaultFrom.name, address: defaultFrom.address } });
    return "sent";
  },
};
