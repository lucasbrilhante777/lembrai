import { randomBytes } from "node:crypto";
import { computeAvailableSlots } from "../domain/availability.js";
import { AppError } from "../errors/app-error.js";
import { isAppointmentOverlapError } from "../lib/db-errors.js";
import { prisma } from "../lib/prisma.js";
import type { AvailabilityQuery, CreateAppointmentInput } from "../schemas/public.schemas.js";
import * as notifications from "./notifications.service.js";
import { findTimeOffsFor } from "./time-offs.service.js";
import {
  addDays,
  dayOfWeek,
  formatLocalTime,
  localDateOf,
  localDateTimeToUtc,
  localToday,
} from "../utils/zoned-date.js";

// Dados e ações disponíveis para qualquer pessoa, sem login: o que a página /agenda/:slug usa.
// Só sai daqui o necessário para agendar. Nada do dono (e-mail, ids internos de usuário).

/** Até quantos dias à frente o cliente pode agendar. */
export const MAX_DAYS_AHEAD = 60;

/** Quantos agendamentos futuros um mesmo e-mail pode ter ao mesmo tempo (freia quem tenta lotar a agenda). */
export const MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER = 3;

export async function getPublicEstablishment(slug: string) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      timezone: true,
      services: {
        where: { active: true },
        select: { id: true, name: true, durationMinutes: true, priceCents: true },
        orderBy: { name: "asc" },
      },
      professionals: {
        where: { active: true },
        select: { id: true, name: true, services: { select: { serviceId: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!establishment) throw new AppError("Estabelecimento não encontrado.", 404);

  // Um profissional pode estar vinculado a um serviço desativado: esse vínculo não deve aparecer.
  const activeServiceIds = new Set(establishment.services.map((s) => s.id));

  return {
    ...establishment,
    professionals: establishment.professionals.map(({ services, ...professional }) => ({
      ...professional,
      serviceIds: services.map((s) => s.serviceId).filter((id) => activeServiceIds.has(id)),
    })),
  };
}

export async function getAvailability(slug: string, query: AvailabilityQuery, now = new Date()) {
  const establishment = await findEstablishmentBySlug(slug);
  assertBookableDate(query.date, establishment.timezone, now);

  const context = await loadBookingContext(establishment.id, query.serviceId, query.professionalId, query.date);
  const slots = await listFreeSlots(establishment.timezone, query.date, context, now);

  return {
    date: query.date,
    timezone: establishment.timezone,
    slots: slots.map((slot) => ({ startAt: slot.startAt.toISOString(), time: slot.time })),
  };
}

export async function createAppointment(slug: string, input: CreateAppointmentInput, now = new Date()) {
  const establishment = await findEstablishmentBySlug(slug);
  const { timezone } = establishment;
  const startAt = new Date(input.startAt);
  const date = localDateOf(startAt, timezone);
  assertBookableDate(date, timezone, now);

  const { service, professional, workingHours } = await loadBookingContext(
    establishment.id,
    input.serviceId,
    input.professionalId,
    date,
  );

  // O horário pedido precisa ser exatamente um dos horários livres: assim valem as mesmas regras
  // da tela (expediente, duração, grade de 15 min, horário passado, conflito).
  const slots = await listFreeSlots(timezone, date, { service, professional, workingHours }, now);
  const slot = slots.find((s) => s.startAt.getTime() === startAt.getTime());
  if (!slot) throw new AppError("Esse horário não está disponível. Escolha outro.", 409);

  // Cliente não tem login: é identificado pelo e-mail dentro do estabelecimento.
  // Se já existe, NÃO sobrescrevemos nome/telefone: quem digita um e-mail alheio não altera o cadastro de outra pessoa.
  const customer = await prisma.customer.upsert({
    where: { establishmentId_email: { establishmentId: establishment.id, email: input.customer.email } },
    create: { ...input.customer, establishmentId: establishment.id },
    update: {},
  });

  const activeCount = await prisma.appointment.count({
    where: { customerId: customer.id, status: "SCHEDULED", startAt: { gt: now } },
  });
  if (activeCount >= MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER) {
    throw new AppError(
      `Você já tem ${MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER} agendamentos marcados neste estabelecimento. Cancele um para marcar outro.`,
      409,
    );
  }

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        establishmentId: establishment.id,
        professionalId: professional.id,
        serviceId: service.id,
        customerId: customer.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        priceCentsAtBooking: service.priceCents, // cópia do preço de agora (ver README, modelo de dados)
        cancelToken: randomBytes(32).toString("base64url"), // 256 bits: impossível de adivinhar
      },
    });
  } catch (err) {
    // Outra pessoa pegou o mesmo horário entre a nossa checagem e o INSERT.
    // A constraint do banco barrou (ADR 0001); aqui só traduzimos para uma resposta amigável.
    if (isAppointmentOverlapError(err)) {
      throw new AppError("Esse horário acabou de ser ocupado. Escolha outro.", 409);
    }
    throw err;
  }

  // O horário já está garantido no banco. Se o e-mail falhar (SMTP fora do ar, por exemplo),
  // NÃO desfazemos o agendamento: só registramos o erro. O lembrete de 24h ainda vai tentar avisar.
  await notifications
    .sendConfirmation(appointment.id)
    .catch((err: unknown) => console.error("Falha ao enviar e-mail de confirmação:", err));

  // O cancelToken NÃO volta na resposta: ele só vai por e-mail para o cliente.
  return {
    id: appointment.id,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    date,
    time: formatLocalTime(appointment.startAt, timezone),
    timezone,
    establishment: { name: establishment.name },
    service: { name: service.name, durationMinutes: service.durationMinutes },
    professional: { name: professional.name },
    priceCents: appointment.priceCentsAtBooking,
  };
}

// ---------------------------------------------------------------------------
// Peças compartilhadas entre a consulta de horários e a criação do agendamento.
// ---------------------------------------------------------------------------

async function findEstablishmentBySlug(slug: string) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug },
    select: { id: true, name: true, timezone: true },
  });
  if (!establishment) throw new AppError("Estabelecimento não encontrado.", 404);
  return establishment;
}

function assertBookableDate(date: string, timezone: string, now: Date) {
  const today = localToday(timezone, now);
  // "AAAA-MM-DD" pode ser comparado como texto.
  if (date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    throw new AppError(`Escolha uma data entre hoje e os próximos ${MAX_DAYS_AHEAD} dias.`, 400);
  }
}

type BookingContext = Awaited<ReturnType<typeof loadBookingContext>>;

async function loadBookingContext(establishmentId: string, serviceId: string, professionalId: string, date: string) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, establishmentId, active: true },
  });
  if (!service) throw new AppError("Serviço não encontrado.", 404);

  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, establishmentId, active: true },
    include: {
      services: { where: { serviceId: service.id } },
      workingHours: { where: { dayOfWeek: dayOfWeek(date) } },
    },
  });
  if (!professional) throw new AppError("Profissional não encontrado.", 404);
  if (professional.services.length === 0) {
    throw new AppError("Esse profissional não realiza esse serviço.", 400);
  }

  return { service, professional, workingHours: professional.workingHours };
}

async function listFreeSlots(timezone: string, date: string, context: BookingContext, now: Date) {
  // Agendamentos ativos e bloqueios que encostam no dia LOCAL (meia-noite a meia-noite no fuso do estabelecimento).
  const dayStart = localDateTimeToUtc(date, "00:00", timezone);
  const dayEnd = localDateTimeToUtc(addDays(date, 1), "00:00", timezone);
  const busy = await prisma.appointment.findMany({
    where: {
      professionalId: context.professional.id,
      status: { not: "CANCELED" },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });
  // Bloqueios (folga, feriado...) entram como "ocupado": para o cálculo, tanto faz o motivo.
  const timeOffs = await findTimeOffsFor(context.professional.establishmentId, context.professional.id, dayStart, dayEnd);

  return computeAvailableSlots({
    date,
    timezone,
    workingHours: context.workingHours,
    durationMinutes: context.service.durationMinutes,
    busy: [...busy, ...timeOffs],
    now,
  });
}
