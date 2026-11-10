import { prisma } from "../lib/prisma.js";
import { sendReminder } from "../services/notifications.service.js";

/** O lembrete sai quando faltam até 24h para o horário. */
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

// Roda a cada 15 minutos (ver scheduler.ts). Pode rodar várias vezes, em várias instâncias da API,
// e mesmo assim cada cliente recebe o lembrete UMA vez só — é isso que "idempotente" quer dizer aqui.
export async function sendDueReminders(now = new Date()) {
  const due = await prisma.appointment.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      startAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
    },
    select: { id: true, startAt: true, createdAt: true },
  });

  let sent = 0;
  for (const appointment of due) {
    // Quem agendou com menos de 24h de antecedência acabou de receber a confirmação:
    // um "lembrete" minutos depois seria só ruído.
    if (appointment.startAt.getTime() - appointment.createdAt.getTime() < REMINDER_WINDOW_MS) continue;

    // 1. "Reserva" o envio: só uma execução consegue mudar reminderSentAt de null para a data.
    //    Se outra instância chegar antes, count vem 0 e esta pula.
    const { count } = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (count === 0) continue;

    // 2. Envia. Se falhar, desfaz a reserva para a próxima execução tentar de novo.
    try {
      await sendReminder(appointment.id);
      sent++;
    } catch (err) {
      console.error(`Falha ao enviar lembrete do agendamento ${appointment.id}:`, err);
      await prisma.appointment.update({ where: { id: appointment.id }, data: { reminderSentAt: null } });
    }
  }

  return { sent };
}
