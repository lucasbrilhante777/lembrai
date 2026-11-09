import { z } from "zod";

// Lista de serviços que o profissional realiza. Repetições são removidas.
const serviceIds = z
  .array(z.uuid("Id de serviço inválido."))
  .max(100)
  .transform((ids) => [...new Set(ids)]);

export const createProfessionalSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do profissional.").max(80),
  serviceIds: serviceIds.default([]),
});

// serviceIds no update SUBSTITUI a lista inteira (o front manda os checkboxes marcados).
export const updateProfessionalSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    active: z.boolean().optional(),
    serviceIds: serviceIds.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Envie ao menos um campo para atualizar.");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato "HH:MM", ex.: "09:00".');

const workingHoursItem = z
  .object({
    dayOfWeek: z.number().int().min(0, "Dia da semana vai de 0 (domingo) a 6 (sábado).").max(6, "Dia da semana vai de 0 (domingo) a 6 (sábado)."),
    startTime: time,
    endTime: time,
  })
  // "HH:MM" com zero à esquerda pode ser comparado como texto: "09:00" < "18:00".
  .refine((item) => item.startTime < item.endTime, {
    message: "O horário de início precisa ser antes do fim.",
    path: ["endTime"],
  });

// A semana inteira de uma vez: o que for enviado substitui o expediente anterior.
export const replaceWorkingHoursSchema = z.object({
  workingHours: z
    .array(workingHoursItem)
    .max(50)
    .superRefine((items, ctx) => {
      // Dois intervalos no mesmo dia não podem se cruzar (ex.: 09:00–12:00 e 11:00–14:00).
      const sorted = items
        .map((item, index) => ({ ...item, index }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        if (prev.dayOfWeek === curr.dayOfWeek && curr.startTime < prev.endTime) {
          ctx.addIssue({
            code: "custom",
            message: "Há intervalos que se sobrepõem no mesmo dia.",
            path: [curr.index],
          });
        }
      }
    }),
});

export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
export type ReplaceWorkingHoursInput = z.infer<typeof replaceWorkingHoursSchema>;
