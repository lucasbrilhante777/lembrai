import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(80),
  durationMinutes: z
    .number()
    .int("A duração precisa ser um número inteiro de minutos.")
    .min(5, "A duração mínima é de 5 minutos.")
    .max(600, "A duração máxima é de 10 horas."),
  // Em centavos: R$ 35,00 = 3500. O front faz a conversão.
  priceCents: z
    .number()
    .int("O preço precisa estar em centavos (número inteiro).")
    .min(0, "O preço não pode ser negativo.")
    .max(10_000_000, "Preço acima do permitido."),
});

// No update, tudo é opcional, e dá para desativar o serviço.
export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, "Envie ao menos um campo para atualizar.");

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
