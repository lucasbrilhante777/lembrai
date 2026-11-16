import { z } from "zod";

export const CUSTOMERS_PAGE_SIZE = 20;

export const listCustomersQuerySchema = z.object({
  // Busca por nome, e-mail ou telefone. Vazio = todos.
  search: z.string().trim().max(80).optional().default(""),
  // Página começando em 1 (paginação por offset: pula (page - 1) × 20 registros).
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
