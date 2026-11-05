import { z } from "zod";

// Valida as variáveis de ambiente uma única vez, na inicialização.
// Se faltar algo obrigatório, a API nem sobe — melhor do que quebrar no meio de uma requisição.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  DATABASE_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variáveis de ambiente inválidas:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
