import { z } from "zod";

/** Período máximo de uma consulta do calendário (um mês com folga). */
export const MAX_RANGE_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

// Datas LOCAIS (no fuso do estabelecimento), inclusivas: from=2026-11-16&to=2026-11-22 é a semana inteira.
export const listAppointmentsQuerySchema = z
  .object({
    from: z.iso.date("Use o formato de data AAAA-MM-DD."),
    to: z.iso.date("Use o formato de data AAAA-MM-DD."),
    professionalId: z.uuid("Profissional inválido.").optional(),
  })
  .refine((q) => q.from <= q.to, { message: "A data final precisa ser igual ou depois da inicial.", path: ["to"] })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS < MAX_RANGE_DAYS, {
    message: `Consulte no máximo ${MAX_RANGE_DAYS} dias por vez.`,
    path: ["to"],
  });

export const updateStatusSchema = z.object({
  // SCHEDULED não entra: um agendamento não "volta" a ficar marcado.
  status: z.enum(["COMPLETED", "NO_SHOW", "CANCELED"], "Status inválido. Use COMPLETED, NO_SHOW ou CANCELED."),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
