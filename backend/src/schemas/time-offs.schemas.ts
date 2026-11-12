import { z } from "zod";

/** Um bloqueio pode cobrir no máximo um ano (evita erro de digitação tipo 2062 em vez de 2026). */
export const MAX_TIME_OFF_DAYS = 366;

const date = z.iso.date("Use o formato de data AAAA-MM-DD.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato "HH:MM".');
const professionalId = z.uuid("Profissional inválido.").nullable().default(null); // null = estabelecimento inteiro
const reason = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || null);

const DAY_MS = 24 * 60 * 60 * 1000;

// Duas formas de bloquear, sempre em datas/horas LOCAIS do estabelecimento (o service converte para UTC):
//   - "days":  dias inteiros, de startDate até endDate (inclusive). Ex.: férias de 20 a 30/12.
//   - "hours": parte de um dia. Ex.: quinta das 14:00 às 16:00 (consulta médica).
export const createTimeOffSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("days"), professionalId, reason, startDate: date, endDate: date }),
    z.object({ kind: z.literal("hours"), professionalId, reason, date, startTime: time, endTime: time }),
  ])
  .superRefine((input, ctx) => {
    if (input.kind === "days") {
      const days = (Date.parse(input.endDate) - Date.parse(input.startDate)) / DAY_MS + 1;
      if (days < 1) ctx.addIssue({ code: "custom", path: ["endDate"], message: "A data final precisa ser igual ou depois da inicial." });
      else if (days > MAX_TIME_OFF_DAYS) ctx.addIssue({ code: "custom", path: ["endDate"], message: `O bloqueio pode ter no máximo ${MAX_TIME_OFF_DAYS} dias.` });
    } else if (input.startTime >= input.endTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "O horário de início precisa ser antes do fim." });
    }
  });

export const listTimeOffsQuerySchema = z.object({
  // Período em datas locais (inclusivo). Sem período: os bloqueios atuais e futuros.
  from: date.optional(),
  to: date.optional(),
});

export type CreateTimeOffInput = z.infer<typeof createTimeOffSchema>;
export type ListTimeOffsQuery = z.infer<typeof listTimeOffsQuerySchema>;
