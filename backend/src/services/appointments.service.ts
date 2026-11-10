import { statusChangeError } from "../domain/appointment-status.js";
import { AppError } from "../errors/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { ListAppointmentsQuery, UpdateStatusInput } from "../schemas/appointments.schemas.js";
import { addDays, formatLocalTime, localDateOf, localDateTimeToUtc } from "../utils/zoned-date.js";
import * as notifications from "./notifications.service.js";

// Agenda do dono (rotas com login). Tudo filtrado pelo establishmentId do token, como nos outros módulos.

const appointmentInclude = {
  customer: { select: { name: true, email: true, phone: true } },
  service: { select: { id: true, name: true } },
  professional: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export async function listAppointments(establishmentId: string, query: ListAppointmentsQuery) {
  const { timezone } = await getEstablishment(establishmentId);

  // De meia-noite de `from` até meia-noite do dia seguinte a `to`, no fuso do estabelecimento (ADR 0002).
  // Ex.: um horário às 23:30 em Recife (02:30 UTC do dia seguinte) aparece no dia certo.
  const rangeStart = localDateTimeToUtc(query.from, "00:00", timezone);
  const rangeEnd = localDateTimeToUtc(addDays(query.to, 1), "00:00", timezone);

  const rows = await prisma.appointment.findMany({
    where: {
      establishmentId,
      professionalId: query.professionalId,
      startAt: { gte: rangeStart, lt: rangeEnd },
    },
    include: appointmentInclude,
    orderBy: [{ startAt: "asc" }, { professional: { name: "asc" } }],
  });

  return { from: query.from, to: query.to, timezone, appointments: rows.map((row) => toDto(row, timezone)) };
}

export async function updateStatus(
  establishmentId: string,
  appointmentId: string,
  input: UpdateStatusInput,
  now = new Date(),
) {
  const { timezone } = await getEstablishment(establishmentId);
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, establishmentId } });
  if (!appointment) throw new AppError("Agendamento não encontrado.", 404);

  const error = statusChangeError(appointment.status, input.status, appointment.startAt, now);
  if (error) throw new AppError(error, 409);

  if (appointment.status !== input.status) {
    // Só aplica se o status ainda for o que lemos. Se o cliente cancelou pelo e-mail no mesmo instante,
    // count vem 0 e o dono é avisado, em vez de uma mudança sobrescrever a outra em silêncio.
    const { count } = await prisma.appointment.updateMany({
      where: { id: appointment.id, establishmentId, status: appointment.status },
      data: { status: input.status },
    });
    if (count === 0) throw new AppError("Esse agendamento acabou de ser alterado. Atualize a agenda.", 409);

    if (input.status === "CANCELED") {
      await notifications
        .sendCancellationByEstablishment(appointment.id)
        .catch((err: unknown) => console.error("Falha ao avisar o cliente do cancelamento:", err));
    }
  }

  const updated = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    include: appointmentInclude,
  });
  return toDto(updated, timezone);
}

async function getEstablishment(establishmentId: string) {
  return prisma.establishment.findUniqueOrThrow({ where: { id: establishmentId }, select: { timezone: true } });
}

// Formato da agenda: instantes em UTC + data/hora local prontas para exibir.
function toDto(row: AppointmentRow, timezone: string) {
  return {
    id: row.id,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    date: localDateOf(row.startAt, timezone),
    time: formatLocalTime(row.startAt, timezone),
    endTime: formatLocalTime(row.endAt, timezone),
    priceCents: row.priceCentsAtBooking,
    customer: row.customer,
    service: row.service,
    professional: row.professional,
  };
}
