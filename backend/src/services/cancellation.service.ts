import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";
import { formatLocalTime, localDateOf } from "../utils/zoned-date.js";

// Cancelamento pelo link do e-mail. Quem tem o token (256 bits aleatórios) tem o direito de cancelar
// aquele agendamento — e só aquele. Não precisa de login.
//
// Por que GET mostra e POST cancela: leitores de e-mail (Outlook, antivírus) costumam "visitar" os
// links para checar se são seguros. Se o GET cancelasse, o agendamento sumiria sem o cliente clicar.

export async function getAppointmentByToken(token: string) {
  const appointment = await findByToken(token);
  return toSummary(appointment);
}

export async function cancelAppointmentByToken(token: string, now = new Date()) {
  const appointment = await findByToken(token);

  // Cancelar duas vezes não é erro (o cliente pode clicar de novo): só devolve o estado atual.
  if (appointment.status === "CANCELED") return toSummary(appointment);

  if (appointment.status !== "SCHEDULED" || appointment.startAt <= now) {
    throw new AppError("Esse agendamento não pode mais ser cancelado.", 409);
  }

  // Atualiza só se continuar SCHEDULED e no futuro: se o dono marcar "concluído" no mesmo instante,
  // as duas ações não se atropelam.
  const { count } = await prisma.appointment.updateMany({
    where: { id: appointment.id, status: "SCHEDULED", startAt: { gt: now } },
    data: { status: "CANCELED" },
  });
  if (count === 0) throw new AppError("Esse agendamento não pode mais ser cancelado.", 409);

  return toSummary(await findByToken(token));
}

async function findByToken(token: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: { service: true, professional: true, establishment: true },
  });
  if (!appointment) throw new AppError("Agendamento não encontrado.", 404);
  return appointment;
}

type AppointmentWithRelations = Awaited<ReturnType<typeof findByToken>>;

// O suficiente para a página "Cancelar agendamento" mostrar do que se trata. Sem dados do cliente.
function toSummary(appointment: AppointmentWithRelations) {
  const { timezone } = appointment.establishment;
  return {
    status: appointment.status,
    startAt: appointment.startAt.toISOString(),
    date: localDateOf(appointment.startAt, timezone),
    time: formatLocalTime(appointment.startAt, timezone),
    timezone,
    establishment: { name: appointment.establishment.name, slug: appointment.establishment.slug },
    service: { name: appointment.service.name },
    professional: { name: appointment.professional.name },
  };
}
