import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { addDays, localDateTimeToUtc, localToday } from "../src/utils/zoned-date.js";
import { insertAppointment } from "./helpers/appointments.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, at, date, setupEstablishment } from "./helpers/establishment.js";

// setupEstablishment: João faz Corte (30 min) das 09:00 às 11:00 em `date` (daqui a 7 dias), fuso de Recife.

const app = createApp();
let setup: EstablishmentSetup;

async function freeTimes(professionalId = setup.professionalId) {
  const params = new URLSearchParams({ serviceId: setup.serviceId, professionalId, date });
  const res = await request(app).get(`/public/establishments/${setup.slug}/availability?${params}`);
  return res.body.slots.map((s: { time: string }) => s.time) as string[];
}

function block(body: Record<string, unknown>, agent = setup.agent) {
  return agent.post("/time-offs").send(body);
}

beforeEach(async () => {
  await resetDatabase();
  setup = await setupEstablishment(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("bloqueios: efeito na disponibilidade", () => {
  it("bloqueio de algumas horas tira só os horários que se cruzam com ele", async () => {
    const res = await block({
      kind: "hours",
      professionalId: setup.professionalId,
      date,
      startTime: "09:30",
      endTime: "10:00",
      reason: "Consulta médica",
    });

    expect(res.status).toBe(201);
    // 09:15 (até 09:45), 09:30 e 09:45 cruzam o bloqueio; 09:00 termina 09:30 e 10:00 começa 10:00: encostam.
    expect(await freeTimes()).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });

  it("bloqueio do estabelecimento inteiro (feriado) vale para todos os profissionais", async () => {
    const res = await block({ kind: "days", startDate: date, endDate: date, reason: "Feriado" });

    expect(res.status).toBe(201);
    expect(res.body.timeOff).toMatchObject({
      professional: null,
      allDay: true,
      startDate: date,
      endDate: date,
      startAt: localDateTimeToUtc(date, "00:00", TZ).toISOString(), // meia-noite em Recife = 03:00 UTC
    });
    expect(await freeTimes()).toEqual([]);
  });

  it("bloqueio de outro profissional não afeta o João", async () => {
    const { body: pedro } = await setup.agent.post("/professionals").send({ name: "Pedro" });

    await block({ kind: "days", professionalId: pedro.id, startDate: date, endDate: date });

    expect(await freeTimes()).toHaveLength(7);
  });

  it("a API recusa agendar num horário bloqueado", async () => {
    await block({ kind: "hours", professionalId: setup.professionalId, date, startTime: "09:00", endTime: "11:00" });

    const res = await request(app)
      .post(`/public/establishments/${setup.slug}/appointments`)
      .send({
        serviceId: setup.serviceId,
        professionalId: setup.professionalId,
        startAt: at("09:00"),
        customer: { name: "Maria", email: "maria@teste.com", phone: "81999999999" },
        consent: true,
      });

    expect(res.status).toBe(409);
  });

  it("remover o bloqueio devolve os horários", async () => {
    const { body } = await block({ kind: "days", startDate: date, endDate: date });

    const res = await setup.agent.delete(`/time-offs/${body.timeOff.id}`);

    expect(res.status).toBe(204);
    expect(await freeTimes()).toHaveLength(7);
  });
});

describe("bloqueios: agendamentos que já existiam", () => {
  it("não cancela ninguém, mas devolve os agendamentos do período para o painel avisar", async () => {
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const res = await block({ kind: "days", startDate: date, endDate: date, reason: "Feriado" });

    expect(res.body.conflicts).toEqual([
      { id: appointment.id, date, time: "09:00", customer: "Maria Silva", professional: "João" },
    ]);
    const still = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(still.status).toBe("SCHEDULED");
  });
});

describe("bloqueios: listagem", () => {
  it("sem período, lista os atuais e futuros em ordem; com período, só os que encostam nele", async () => {
    await block({ kind: "days", startDate: addDays(date, 3), endDate: addDays(date, 4), reason: "Férias" });
    await block({ kind: "hours", professionalId: setup.professionalId, date, startTime: "14:00", endTime: "16:00" });

    const upcoming = await setup.agent.get("/time-offs");
    const week = await setup.agent.get(`/time-offs?from=${date}&to=${addDays(date, 1)}`);

    expect(upcoming.body.map((t: { startDate: string }) => t.startDate)).toEqual([date, addDays(date, 3)]);
    expect(upcoming.body[0]).toMatchObject({ allDay: false, startTime: "14:00", endTime: "16:00", professional: { name: "João" } });
    expect(upcoming.body[1]).toMatchObject({ allDay: true, startDate: addDays(date, 3), endDate: addDays(date, 4), reason: "Férias" });
    expect(week.body).toHaveLength(1);
  });
});

describe("bloqueios: validação", () => {
  it.each([
    ["fim antes do início (horas)", { kind: "hours", date, startTime: "16:00", endTime: "14:00" }],
    ["data final antes da inicial", { kind: "days", startDate: date, endDate: addDays(date, -1) }],
    ["mais de um ano", { kind: "days", startDate: date, endDate: addDays(date, 400) }],
    ["tipo desconhecido", { kind: "semanas", startDate: date }],
  ])("recusa %s com 400", async (_label, body) => {
    expect((await block(body)).status).toBe(400);
  });

  it("recusa período que já passou", async () => {
    const yesterday = addDays(localToday(TZ, new Date()), -1);

    const res = await block({ kind: "days", startDate: yesterday, endDate: yesterday });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Esse período já passou.");
  });
});

describe("bloqueios: isolamento entre estabelecimentos", () => {
  it("exige login", async () => {
    expect((await request(app).get("/time-offs")).status).toBe(401);
  });

  it("um dono não vê, não remove e não bloqueia o profissional de outro", async () => {
    const { body } = await block({ kind: "days", startDate: date, endDate: date });
    const outro = await createLoggedOwner(app, "Barbearia B");

    const list = await outro.agent.get("/time-offs");
    const remove = await outro.agent.delete(`/time-offs/${body.timeOff.id}`);
    const blockOther = await block(
      { kind: "days", professionalId: setup.professionalId, startDate: date, endDate: date },
      outro.agent,
    );

    expect(list.body).toEqual([]);
    expect(remove.status).toBe(404);
    expect(blockOther.status).toBe(404);
    expect(await prisma.timeOff.count()).toBe(1);
  });
});
