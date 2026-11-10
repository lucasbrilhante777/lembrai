import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER } from "../src/services/public.service.js";
import { addDays, localDateTimeToUtc, localToday } from "../src/utils/zoned-date.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, at, date, setupEstablishment } from "./helpers/establishment.js";

const app = createApp();

const maria = { name: "Maria Silva", email: "maria@teste.com", phone: "(81) 99999-9999" };

function book(setup: EstablishmentSetup, startAt: string, customer = maria, extra: Record<string, unknown> = {}) {
  return request(app)
    .post(`/public/establishments/${setup.slug}/appointments`)
    .send({
      serviceId: setup.serviceId,
      professionalId: setup.professionalId,
      startAt,
      customer,
      consent: true,
      ...extra,
    });
}

async function freeTimes(setup: EstablishmentSetup) {
  const params = new URLSearchParams({ serviceId: setup.serviceId, professionalId: setup.professionalId, date });
  const res = await request(app).get(`/public/establishments/${setup.slug}/availability?${params}`);
  return res.body.slots.map((s: { time: string }) => s.time) as string[];
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /public/establishments/:slug/appointments", () => {
  it("agenda um horário livre, sem login", async () => {
    const setup = await setupEstablishment(app);

    const res = await book(setup, at("09:00"));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      startAt: at("09:00"),
      endAt: at("09:30"),
      date,
      time: "09:00",
      timezone: TZ,
      establishment: { name: "Barbearia Teste" },
      service: { name: "Corte", durationMinutes: 30 },
      professional: { name: "João" },
      priceCents: 3500,
    });
    // O token de cancelamento só vai por e-mail, nunca na resposta.
    expect(res.body).not.toHaveProperty("cancelToken");

    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.id }, include: { customer: true } });
    expect(saved.status).toBe("SCHEDULED");
    expect(saved.cancelToken.length).toBeGreaterThanOrEqual(43); // 32 bytes em base64url
    expect(saved.customer).toMatchObject({ name: "Maria Silva", email: "maria@teste.com", phone: "81999999999" });
  });

  it("o horário agendado some da lista de horários livres", async () => {
    const setup = await setupEstablishment(app);

    await book(setup, at("09:00"));

    expect(await freeTimes(setup)).toEqual(["09:30", "09:45", "10:00", "10:15", "10:30"]);
  });

  it("guarda o preço do momento: mudar o preço do serviço depois não altera o agendamento", async () => {
    const setup = await setupEstablishment(app);
    const { body } = await book(setup, at("09:00"));

    await setup.agent.patch(`/services/${setup.serviceId}`).send({ priceCents: 5000 });

    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: body.id } });
    expect(saved.priceCentsAtBooking).toBe(3500);
  });

  it("reaproveita o cliente pelo e-mail, sem sobrescrever o cadastro", async () => {
    const setup = await setupEstablishment(app);

    await book(setup, at("09:00"));
    await book(setup, at("10:00"), { name: "Outro Nome", email: "MARIA@teste.com", phone: "81888888888" });

    const customers = await prisma.customer.findMany();
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ name: "Maria Silva", phone: "81999999999" });
    expect(await prisma.appointment.count()).toBe(2);
  });

  it("recusa horário já ocupado com 409", async () => {
    const setup = await setupEstablishment(app);
    await book(setup, at("09:00"));

    const res = await book(setup, at("09:15"), { ...maria, email: "joana@teste.com" });

    expect(res.status).toBe(409);
  });

  it("com dois clientes pedindo o mesmo horário ao mesmo tempo, um consegue e o outro recebe 409 (não 500)", async () => {
    const setup = await setupEstablishment(app);

    const responses = await Promise.all([
      book(setup, at("09:00"), { ...maria, email: "a@teste.com" }),
      book(setup, at("09:00"), { ...maria, email: "b@teste.com" }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("se a checagem deixar passar um conflito, a constraint do banco barra e a API responde 409", async () => {
    const setup = await setupEstablishment(app);
    await book(setup, at("09:00"));
    // Simula a corrida: a consulta de horários ocupados "não vê" o agendamento que já existe,
    // então a checagem da aplicação passa e quem barra é o Postgres (ADR 0001).
    vi.spyOn(prisma.appointment, "findMany").mockResolvedValue([]);

    const res = await book(setup, at("09:00"), { ...maria, email: "joana@teste.com" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Esse horário acabou de ser ocupado. Escolha outro.");
    expect(await prisma.appointment.count()).toBe(1);
  });

  it.each([
    ["fora do expediente", "11:00"],
    ["fora da grade de 15 minutos", "09:07"],
    ["que não cabe antes do fim do expediente", "10:45"],
  ])("recusa horário %s com 409", async (_label, time) => {
    const setup = await setupEstablishment(app);

    const res = await book(setup, at(time));

    expect(res.status).toBe(409);
  });

  it("recusa data no passado com 400", async () => {
    const setup = await setupEstablishment(app);
    const yesterday = addDays(localToday(TZ, new Date()), -1);

    const res = await book(setup, localDateTimeToUtc(yesterday, "09:00", TZ).toISOString());

    expect(res.status).toBe(400);
  });

  it("exige consentimento e dados válidos do cliente", async () => {
    const setup = await setupEstablishment(app);

    const res = await book(setup, at("09:00"), { name: "M", email: "nao-e-email", phone: "123" }, { consent: false });

    expect(res.status).toBe(400);
    const paths = res.body.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(["customer.name", "customer.email", "customer.phone", "consent"]),
    );
  });

  it(`limita a ${MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER} agendamentos futuros por e-mail`, async () => {
    const setup = await setupEstablishment(app);
    for (const time of ["09:00", "09:30", "10:00"]) {
      expect((await book(setup, at(time))).status).toBe(201);
    }

    const res = await book(setup, at("10:30"));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Cancele um para marcar outro/);
  });

  it("não agenda com serviço de outro estabelecimento", async () => {
    const setupA = await setupEstablishment(app);
    const setupB = await setupEstablishment(app);

    const res = await book(setupA, at("09:00"), maria, { serviceId: setupB.serviceId });

    expect(res.status).toBe(404);
    expect(await prisma.appointment.count()).toBe(0);
  });
});
