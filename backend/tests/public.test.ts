import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { MAX_DAYS_AHEAD } from "../src/services/public.service.js";
import { addDays, localDateTimeToUtc, localToday } from "../src/utils/zoned-date.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, date, setupEstablishment as setup } from "./helpers/establishment.js";

const app = createApp();
const setupEstablishment = () => setup(app);

function availabilityUrl(slug: string, params: Record<string, string>) {
  return `/public/establishments/${slug}/availability?${new URLSearchParams(params)}`;
}

async function createAppointment(
  setup: EstablishmentSetup,
  start: string,
  end: string,
  status: "SCHEDULED" | "CANCELED" = "SCHEDULED",
) {
  const customer = await prisma.customer.upsert({
    where: { establishmentId_email: { establishmentId: setup.establishmentId, email: "maria@teste.com" } },
    create: { name: "Maria", email: "maria@teste.com", phone: "81999999999", establishmentId: setup.establishmentId },
    update: {},
  });
  await prisma.appointment.create({
    data: {
      establishmentId: setup.establishmentId,
      professionalId: setup.professionalId,
      serviceId: setup.serviceId,
      customerId: customer.id,
      startAt: localDateTimeToUtc(date, start, TZ),
      endAt: localDateTimeToUtc(date, end, TZ),
      priceCentsAtBooking: 3500,
      status,
      cancelToken: randomUUID(),
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /public/establishments/:slug", () => {
  it("devolve os dados da página de agendamento, sem login", async () => {
    const setup = await setupEstablishment();

    const res = await request(app).get(`/public/establishments/${setup.slug}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      name: "Barbearia Teste",
      slug: setup.slug,
      timezone: TZ,
      services: [{ id: setup.serviceId, name: "Corte", durationMinutes: 30, priceCents: 3500 }],
      professionals: [{ id: setup.professionalId, name: "João", serviceIds: [setup.serviceId] }],
    });
  });

  it("esconde serviços e profissionais desativados", async () => {
    const setup = await setupEstablishment();
    await setup.agent.patch(`/services/${setup.serviceId}`).send({ active: false });
    const { body: pedro } = await setup.agent.post("/professionals").send({ name: "Pedro" });
    await setup.agent.patch(`/professionals/${pedro.id}`).send({ active: false });

    const res = await request(app).get(`/public/establishments/${setup.slug}`);

    expect(res.body.services).toEqual([]);
    expect(res.body.professionals).toEqual([{ id: setup.professionalId, name: "João", serviceIds: [] }]);
  });

  it("responde 404 para slug inexistente", async () => {
    const res = await request(app).get("/public/establishments/nao-existe");

    expect(res.status).toBe(404);
  });
});

describe("GET /public/establishments/:slug/availability", () => {
  it("lista os horários livres do dia, sem login", async () => {
    const setup = await setupEstablishment();

    const res = await request(app).get(
      availabilityUrl(setup.slug, { serviceId: setup.serviceId, professionalId: setup.professionalId, date }),
    );

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.slots.map((s: { time: string }) => s.time)).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30",
    ]);
    expect(res.body.slots[0].startAt).toBe(localDateTimeToUtc(date, "09:00", TZ).toISOString());
  });

  it("tira os horários ocupados, mas não os de agendamentos cancelados", async () => {
    const setup = await setupEstablishment();
    await createAppointment(setup, "09:30", "10:00");
    await createAppointment(setup, "10:30", "11:00", "CANCELED");

    const res = await request(app).get(
      availabilityUrl(setup.slug, { serviceId: setup.serviceId, professionalId: setup.professionalId, date }),
    );

    expect(res.body.slots.map((s: { time: string }) => s.time)).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });

  it("dia sem expediente não tem horários", async () => {
    const setup = await setupEstablishment();

    const res = await request(app).get(
      availabilityUrl(setup.slug, {
        serviceId: setup.serviceId,
        professionalId: setup.professionalId,
        date: addDays(date, 1),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([]);
  });

  it("recusa profissional que não faz o serviço", async () => {
    const setup = await setupEstablishment();
    const { body: barba } = await setup.agent
      .post("/services")
      .send({ name: "Barba", durationMinutes: 20, priceCents: 2000 });

    const res = await request(app).get(
      availabilityUrl(setup.slug, { serviceId: barba.id, professionalId: setup.professionalId, date }),
    );

    expect(res.status).toBe(400);
  });

  it("não usa serviço nem profissional de outro estabelecimento", async () => {
    const setupA = await setupEstablishment();
    const setupB = await setupEstablishment();

    const outroServico = await request(app).get(
      availabilityUrl(setupA.slug, { serviceId: setupB.serviceId, professionalId: setupA.professionalId, date }),
    );
    const outroProfissional = await request(app).get(
      availabilityUrl(setupA.slug, { serviceId: setupA.serviceId, professionalId: setupB.professionalId, date }),
    );

    expect(outroServico.status).toBe(404);
    expect(outroProfissional.status).toBe(404);
  });

  it.each([
    ["data no passado", () => addDays(localToday(TZ, new Date()), -1)],
    ["data além do limite", () => addDays(localToday(TZ, new Date()), MAX_DAYS_AHEAD + 1)],
    ["data em formato inválido", () => "10/11/2026"],
  ])("recusa %s com 400", async (_label, makeDate) => {
    const setup = await setupEstablishment();

    const res = await request(app).get(
      availabilityUrl(setup.slug, { serviceId: setup.serviceId, professionalId: setup.professionalId, date: makeDate() }),
    );

    expect(res.status).toBe(400);
  });
});
