import { computeAvailableSlots } from "../domain/availability.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import type { AvailabilityQuery } from "../schemas/public.schemas.js";
import { addDays, dayOfWeek, localDateTimeToUtc, localToday } from "../utils/zoned-date.js";

// Dados que qualquer pessoa pode ver, sem login: o que aparece na página /agenda/:slug.
// Só sai daqui o necessário para agendar. Nada do dono (e-mail, ids internos de usuário).

/** Até quantos dias à frente o cliente pode agendar. */
export const MAX_DAYS_AHEAD = 60;

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
  const establishment = await prisma.establishment.findUnique({
    where: { slug },
    select: { id: true, timezone: true },
  });
  if (!establishment) throw new AppError("Estabelecimento não encontrado.", 404);

  const { timezone } = establishment;
  const today = localToday(timezone, now);
  // "AAAA-MM-DD" pode ser comparado como texto.
  if (query.date < today || query.date > addDays(today, MAX_DAYS_AHEAD)) {
    throw new AppError(`Escolha uma data entre hoje e os próximos ${MAX_DAYS_AHEAD} dias.`, 400);
  }

  const service = await prisma.service.findFirst({
    where: { id: query.serviceId, establishmentId: establishment.id, active: true },
  });
  if (!service) throw new AppError("Serviço não encontrado.", 404);

  const professional = await prisma.professional.findFirst({
    where: { id: query.professionalId, establishmentId: establishment.id, active: true },
    include: {
      services: { where: { serviceId: service.id } },
      workingHours: { where: { dayOfWeek: dayOfWeek(query.date) } },
    },
  });
  if (!professional) throw new AppError("Profissional não encontrado.", 404);
  if (professional.services.length === 0) {
    throw new AppError("Esse profissional não realiza esse serviço.", 400);
  }

  // Agendamentos ativos que encostam no dia LOCAL (meia-noite a meia-noite no fuso do estabelecimento).
  const dayStart = localDateTimeToUtc(query.date, "00:00", timezone);
  const dayEnd = localDateTimeToUtc(addDays(query.date, 1), "00:00", timezone);
  const busy = await prisma.appointment.findMany({
    where: {
      professionalId: professional.id,
      status: { not: "CANCELED" },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: { startAt: true, endAt: true },
  });

  const slots = computeAvailableSlots({
    date: query.date,
    timezone,
    workingHours: professional.workingHours,
    durationMinutes: service.durationMinutes,
    busy,
    now,
  });

  return {
    date: query.date,
    timezone,
    slots: slots.map((slot) => ({ startAt: slot.startAt.toISOString(), time: slot.time })),
  };
}
