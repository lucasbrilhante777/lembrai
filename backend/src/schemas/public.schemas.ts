import { z } from "zod";

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid("Serviço inválido."),
  professionalId: z.uuid("Profissional inválido."),
  date: z.iso.date("Use o formato de data AAAA-MM-DD."),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
