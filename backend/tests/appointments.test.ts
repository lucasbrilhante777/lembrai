import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { type EmailMessage, mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { addDays, localDateTimeToUtc } from "../src/utils/zoned-date.js";
import { insertAppointment } from "./helpers/appointments.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, at, date, setupEstablishment } from "./helpers/establishment.js";

const app = createApp();
const HOUR = 60 * 60_000;

let setup: EstablishmentSetup;

function listUrl(params: Record<string, string>) {
  return `/appointments?${new URLSearchParams(params)}`;
}

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

describe("GET /appointments (agenda do dono)", () => {
  it("exige login", async () => {
    expect((await request(app).get(listUrl({ from: date, to: date }))).status).toBe(401);
  });

  it("lista os agendamentos do período em ordem, com os dados do cliente", async () => {
    await insertAppointment(setup, { startAt: new Date(at("10:00")), email: "joana@teste.com" });
    await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const res = await setup.agent.get(listUrl({ from: date, to: date }));

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.appointments.map((a: { time: string }) => a.time)).toEqual(["09:00", "10:00"]);
    expect(res.body.appointments[0]).toMatchObject({
      status: "SCHEDULED",
      date,
      time: "09:00",
      endTime: "09:30",
      priceCents: 3500,
      customer: { name: "Maria Silva", email: "maria@teste.com", phone: "81999999999" },
      service: { id: setup.serviceId, name: "Corte" },
      professional: { id: setup.professionalId, name: "João" },
    });
  });

  it("usa o dia local do estabelecimento: 23:30 em Recife (02:30 UTC do dia seguinte) fica no dia certo", async () => {
    await insertAppointment(setup, { startAt: localDateTimeToUtc(date, "23:30", TZ) });
    await insertAppointment(setup, { startAt: localDateTimeToUtc(addDays(date, 1), "09:00", TZ) });

    const res = await setup.agent.get(listUrl({ from: date, to: date }));

    expect(res.body.appointments).toHaveLength(1);
    expect(res.body.appointments[0]).toMatchObject({ date, time: "23:30" });
  });

  it("filtra por profissional", async () => {
    const { body: pedro } = await setup.agent
      .post("/professionals")
      .send({ name: "Pedro", serviceIds: [setup.serviceId] });
    await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const doPedro = await setup.agent.get(listUrl({ from: date, to: date, professionalId: pedro.id }));
    const doJoao = await setup.agent.get(listUrl({ from: date, to: date, professionalId: setup.professionalId }));

    expect(doPedro.body.appointments).toEqual([]);
    expect(doJoao.body.appointments).toHaveLength(1);
  });

  it.each([
    ["data final antes da inicial", { from: date, to: addDays(date, -1) }],
    ["período maior que 31 dias", { from: date, to: addDays(date, 31) }],
    ["data inválida", { from: "17/11/2026", to: date }],
  ])("recusa %s com 400", async (_label, params) => {
    const res = await setup.agent.get(listUrl(params));

    expect(res.status).toBe(400);
  });
});

describe("PATCH /appointments/:id/status", () => {
  const patch = (id: string, status: string, agent = setup.agent) =>
    agent.patch(`/appointments/${id}/status`).send({ status });

  it("marca como concluído um horário que já passou", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(Date.now() - 2 * HOUR) });

    const res = await patch(appointment.id, "COMPLETED");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
  });

  it("marca falta e permite corrigir para concluído", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(Date.now() - 2 * HOUR) });

    await patch(appointment.id, "NO_SHOW");
    const res = await patch(appointment.id, "COMPLETED");

    expect(res.body.status).toBe("COMPLETED");
  });

  it("não marca falta num horário que ainda não chegou", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const res = await patch(appointment.id, "NO_SHOW");

    expect(res.status).toBe(409);
  });

  it("cancela um horário futuro, libera a agenda e avisa o cliente por e-mail", async () => {
    const send = vi.spyOn(mailer, "send");
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const res = await patch(appointment.id, "CANCELED");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELED");
    expect(send).toHaveBeenCalledOnce();
    const email = send.mock.calls[0]![0] as EmailMessage;
    expect(email.to).toBe("maria@teste.com");
    expect(email.subject).toMatch(/^Agendamento cancelado:/);
    expect(email.text).toContain(`/agenda/${setup.slug}`); // link para marcar de novo
  });

  it("cancelado é definitivo", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(Date.now() - 2 * HOUR), status: "CANCELED" });

    const res = await patch(appointment.id, "COMPLETED");

    expect(res.status).toBe(409);
  });

  it("repetir o mesmo status não reenvia e-mail", async () => {
    const send = vi.spyOn(mailer, "send");
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    await patch(appointment.id, "CANCELED");
    const again = await patch(appointment.id, "CANCELED");

    expect(again.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("se o agendamento mudar entre a leitura e a gravação, avisa em vez de sobrescrever", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });
    // Simula o cliente cancelando pelo e-mail no mesmo instante: o UPDATE condicional não encontra mais SCHEDULED.
    vi.spyOn(prisma.appointment, "updateMany").mockResolvedValueOnce({ count: 0 });

    const res = await patch(appointment.id, "CANCELED");

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/acabou de ser alterado/);
  });

  it("recusa status inválido", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    expect((await patch(appointment.id, "SCHEDULED")).status).toBe(400);
    expect((await patch(appointment.id, "QUALQUER")).status).toBe(400);
  });
});

describe("isolamento entre estabelecimentos (agenda)", () => {
  it("um dono não vê nem altera os agendamentos de outro", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(Date.now() - 2 * HOUR) });
    const outroDono = await createLoggedOwner(app, "Barbearia B");
    const today = addDays(date, -7);

    const list = await outroDono.agent.get(listUrl({ from: today, to: addDays(today, 30) }));
    const update = await outroDono.agent.patch(`/appointments/${appointment.id}/status`).send({ status: "NO_SHOW" });

    expect(list.body.appointments).toEqual([]);
    expect(update.status).toBe(404);
    const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(unchanged.status).toBe("SCHEDULED");
  });
});
