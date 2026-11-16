import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { type EmailMessage, mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER } from "../src/services/public.service.js";
import { dayOfWeek } from "../src/utils/zoned-date.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, at, date, setupEstablishment } from "./helpers/establishment.js";

// "Agendar para outra pessoa": o mesmo e-mail com dois horários que se cruzam, com profissionais diferentes
// (ex.: pai e filho cortando o cabelo ao mesmo tempo).

const app = createApp();
let setup: EstablishmentSetup;
let pedroId: string;

const lucas = { name: "Lucas", email: "lucas@teste.com", phone: "81999999999" };

function book(professionalId: string, time: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post(`/public/establishments/${setup.slug}/appointments`)
    .send({
      serviceId: setup.serviceId,
      professionalId,
      startAt: at(time),
      customer: lucas,
      consent: true,
      ...extra,
    });
}

beforeEach(async () => {
  await resetDatabase();
  setup = await setupEstablishment(app); // João faz Corte, 09:00–11:00 em `date`
  const { body: pedro } = await setup.agent
    .post("/professionals")
    .send({ name: "Pedro", serviceIds: [setup.serviceId] });
  await setup.agent
    .put(`/professionals/${pedro.id}/working-hours`)
    .send({ workingHours: [{ dayOfWeek: dayOfWeek(date), startTime: "09:00", endTime: "11:00" }] });
  pedroId = pedro.id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("mesmo e-mail, dois horários que se cruzam", () => {
  it("sem dizer para quem é, a API pergunta (409 com código próprio) e não agenda", async () => {
    await book(setup.professionalId, "09:00");

    const res = await book(pedroId, "09:00");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CUSTOMER_TIME_CONFLICT");
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("a mensagem não revela nada do outro agendamento (a página é pública)", async () => {
    await book(setup.professionalId, "09:00");

    const res = await book(pedroId, "09:15");

    expect(res.body.message).not.toMatch(/João|09:00|Corte/);
  });

  it("dizendo para quem é, agenda e guarda o nome", async () => {
    await book(setup.professionalId, "09:00");

    const res = await book(pedroId, "09:00", { attendeeName: "  Pedrinho  " });

    expect(res.status).toBe(201);
    expect(res.body.attendeeName).toBe("Pedrinho");
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.attendeeName).toBe("Pedrinho");
  });

  it("horários que não se cruzam não perguntam nada", async () => {
    await book(setup.professionalId, "09:00");

    expect((await book(pedroId, "10:00")).status).toBe(201);
  });

  it("um agendamento cancelado não conta", async () => {
    const { body } = await book(setup.professionalId, "09:00");
    await prisma.appointment.update({ where: { id: body.id }, data: { status: "CANCELED" } });

    expect((await book(pedroId, "09:00")).status).toBe(201);
  });

  it("recusa nome muito curto", async () => {
    const res = await book(pedroId, "09:00", { attendeeName: "P" });

    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe("attendeeName");
  });
});

describe("cada 409 da criação tem seu código", () => {
  it("horário ocupado: SLOT_TAKEN", async () => {
    await book(setup.professionalId, "09:00");

    const res = await request(app)
      .post(`/public/establishments/${setup.slug}/appointments`)
      .send({
        serviceId: setup.serviceId,
        professionalId: setup.professionalId,
        startAt: at("09:00"),
        customer: { ...lucas, email: "outra@teste.com" },
        consent: true,
      });

    expect(res.body.code).toBe("SLOT_TAKEN");
  });

  it(`limite de ${MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER} agendamentos: TOO_MANY_APPOINTMENTS`, async () => {
    for (const time of ["09:00", "09:30", "10:00"]) await book(setup.professionalId, time);

    const res = await book(pedroId, "10:30");

    expect(res.body.code).toBe("TOO_MANY_APPOINTMENTS");
  });
});

describe("o nome aparece onde importa", () => {
  it("na agenda, na ficha do cliente e no e-mail de confirmação", async () => {
    const send = vi.spyOn(mailer, "send");
    await book(setup.professionalId, "09:00");
    await book(pedroId, "09:00", { attendeeName: "Pedrinho" });

    const agenda = await setup.agent.get(`/appointments?from=${date}&to=${date}`);
    const customerId = agenda.body.appointments[0].customer.id;
    const ficha = await setup.agent.get(`/customers/${customerId}`);
    const email = send.mock.calls.at(-1)![0] as EmailMessage;

    expect(agenda.body.appointments.map((a: { attendeeName: string | null }) => a.attendeeName).sort()).toEqual([
      "Pedrinho",
      null,
    ]);
    expect(ficha.body.appointments.some((a: { attendeeName: string | null }) => a.attendeeName === "Pedrinho")).toBe(true);
    expect(email.text).toContain("Para: Pedrinho");
  });
});
