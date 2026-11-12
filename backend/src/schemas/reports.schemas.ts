import { z } from "zod";

/** Período máximo de um relatório: um ano. */
export const MAX_REPORT_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

// Datas LOCAIS do estabelecimento, inclusivas (from=2026-11-01&to=2026-11-30 é o mês de novembro).
export const reportQuerySchema = z
  .object({
    from: z.iso.date("Use o formato de data AAAA-MM-DD."),
    to: z.iso.date("Use o formato de data AAAA-MM-DD."),
  })
  .refine((q) => q.from <= q.to, { message: "A data final precisa ser igual ou depois da inicial.", path: ["to"] })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS < MAX_REPORT_DAYS, {
    message: `O relatório pode cobrir no máximo ${MAX_REPORT_DAYS} dias.`,
    path: ["to"],
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
