import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { sendDueReminders } from "../src/jobs/reminders.job.js";
import { type EmailMessage, mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { insertAppointment } from "./helpers/appointments.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, setupEstablishment } from "./helpers/establishment.js";

// O job é chamado direto, com um "agora" fixo: o teste controla o tempo, sem esperar o cron.

const app = createApp();
const HOUR = 60 * 60_000;
const now = new Date();
const inHours = (h: number) => new Date(now.getTime() + h * HOUR);
const threeDaysAgo = new Date(now.getTime() - 72 * HOUR);

let setup: EstablishmentSetup;

beforeEach(async () => {
  await resetDatabase();
  setup = await setupEstablishment(app);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("job de lembretes", () => {
  it("envia o lembrete quando faltam menos de 24h e marca reminderSentAt", async () => {
    const send = vi.spyOn(mailer, "send");
    const appointment = await insertAppointment(setup, { startAt: inHours(10), createdAt: threeDaysAgo });

    const result = await sendDueReminders(now);

    expect(result.sent).toBe(1);
    const email = send.mock.calls[0]![0] as EmailMessage;
    expect(email.to).toBe("maria@teste.com");
    expect(email.subject).toMatch(/^Lembrete: Corte em Barbearia Teste, \d{2}\/\d{2} às \d{2}:\d{2}$/);
    expect(email.text).toContain(`/cancelar/${appointment.cancelToken}`);
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(saved.reminderSentAt).not.toBeNull();
  });

  it("rodar de novo não reenvia (idempotente)", async () => {
    const send = vi.spyOn(mailer, "send");
    await insertAppointment(setup, { startAt: inHours(10), createdAt: threeDaysAgo });

    await sendDueReminders(now);
    await sendDueReminders(now);

    expect(send).toHaveBeenCalledOnce();
  });

  it("duas execuções ao mesmo tempo (ex.: duas instâncias da API) enviam uma vez só", async () => {
    const send = vi.spyOn(mailer, "send");
    await insertAppointment(setup, { startAt: inHours(10), createdAt: threeDaysAgo });

    await Promise.all([sendDueReminders(now), sendDueReminders(now)]);

    expect(send).toHaveBeenCalledOnce();
  });

  it("ainda não envia quando faltam mais de 24h", async () => {
    const send = vi.spyOn(mailer, "send");
    await insertAppointment(setup, { startAt: inHours(30), createdAt: threeDaysAgo });

    await sendDueReminders(now);

    expect(send).not.toHaveBeenCalled();
  });

  it("não envia para agendamentos cancelados", async () => {
    const send = vi.spyOn(mailer, "send");
    await insertAppointment(setup, { startAt: inHours(10), createdAt: threeDaysAgo, status: "CANCELED" });

    await sendDueReminders(now);

    expect(send).not.toHaveBeenCalled();
  });

  it("não envia para quem agendou com menos de 24h de antecedência (já recebeu a confirmação)", async () => {
    const send = vi.spyOn(mailer, "send");
    await insertAppointment(setup, { startAt: inHours(10), createdAt: new Date(now.getTime() - 2 * HOUR) });

    await sendDueReminders(now);

    expect(send).not.toHaveBeenCalled();
  });

  it("se o envio falhar, libera para tentar de novo na próxima rodada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.spyOn(mailer, "send").mockRejectedValueOnce(new Error("SMTP fora do ar"));
    const appointment = await insertAppointment(setup, { startAt: inHours(10), createdAt: threeDaysAgo });

    const first = await sendDueReminders(now);
    const afterFailure = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    const second = await sendDueReminders(now);

    expect(first.sent).toBe(0);
    expect(afterFailure.reminderSentAt).toBeNull();
    expect(second.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
