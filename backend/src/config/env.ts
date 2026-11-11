import { z } from "zod";

// Valida as variáveis de ambiente uma única vez, na inicialização.
// Se faltar algo obrigatório, a API nem sobe — melhor do que quebrar no meio de uma requisição.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres."),

  // E-mail. Os padrões apontam para o Mailpit do docker-compose (desenvolvimento).
  // Sem SMTP_HOST em produção, o envio fica desligado (ver lib/mailer.ts). Em dev, o padrão é o Mailpit.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.stringbool().default(false), // true para porta 465 (TLS direto)
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Lembrai <nao-responda@lembrai.local>"),

  // Liga o job de lembretes junto com a API. Dá para desligar (false) e rodar a API sozinha.
  JOBS_ENABLED: z.stringbool().default(true),

  // Quantos proxies existem entre o cliente e a API (em produção: Vercel + Render = 2).
  // Sem isso, o Express enxerga o IP do proxy, e o rate limit trataria todo mundo como uma pessoa só.
  // Ver docs/adr/0003-deploy-com-proxy-na-vercel.md
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
