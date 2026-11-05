import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido."));

// O bcrypt só considera os primeiros 72 bytes da senha; acima disso, o resto seria ignorado em silêncio.
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

const timezone = z.string().refine(isValidTimezone, "Fuso horário inválido.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email,
  password,
  establishmentName: z.string().trim().min(2, "Informe o nome do estabelecimento."),
  timezone: timezone.default("America/Sao_Paulo"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

function isValidTimezone(value: string) {
  try {
    // Lança RangeError se o fuso não existir (ex.: "America/Recif").
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
