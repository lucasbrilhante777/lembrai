import { z } from "zod";

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid("Serviço inválido."),
  professionalId: z.uuid("Profissional inválido."),
  date: z.iso.date("Use o formato de data AAAA-MM-DD."),
});

// Telefone: guardamos só os dígitos. 10–11 com DDD (ex.: 81999999999), até 13 com o 55 do país.
const phone = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().min(10, "Informe o telefone com DDD.").max(13, "Telefone inválido."));

export const createAppointmentSchema = z.object({
  serviceId: z.uuid("Serviço inválido."),
  professionalId: z.uuid("Profissional inválido."),
  // Instante exato do horário escolhido, como veio da rota de disponibilidade (ex.: "2026-11-17T12:00:00.000Z").
  startAt: z.iso.datetime({ offset: true, message: "Horário inválido." }),
  customer: z.object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80),
    email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
    phone,
  }),
  // LGPD: o cliente precisa concordar com o uso dos dados para o agendamento e o lembrete.
  consent: z.literal(true, "É preciso concordar com o uso dos dados para agendar."),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
