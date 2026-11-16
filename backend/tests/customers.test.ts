import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { localDateTimeToUtc } from "../src/utils/zoned-date.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, date, setupEstablishment } from "./helpers/establishment.js";

const app = createApp();
let setup: EstablishmentSetup;

function customer(name: string, email: string, phone = "81999999999") {
  return prisma.customer.create({ data: { name, email, phone, establishmentId: setup.establishmentId } });
}

let minute = 0; // cada agendamento num horário diferente (o mesmo profissional não pode ter dois juntos)
async function appointment(customerId: string, day: string, status: string, priceCents = 3500) {
  const startAt = localDateTimeToUtc(day, "08:00", TZ);
  startAt.setMinutes(startAt.getMinutes() + 30 * minute++);
  return prisma.appointment.create({
    data: {
      establishmentId: setup.establishmentId,
      professionalId: setup.professionalId,
      serviceId: setup.serviceId,
      customerId,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      priceCentsAtBooking: priceCents,
      status: status as "SCHEDULED",
      cancelToken: randomBytes(16).toString("hex"),
    },
  });
}

const list = (query = "", agent = setup.agent) => agent.get(`/customers${query}`);

beforeEach(async () => {
  await resetDatabase();
  minute = 0;
  setup = await setupEstablishment(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /customers", () => {
  it("exige login", async () => {
    expect((await request(app).get("/customers")).status).toBe(401);
  });

  it("lista em ordem alfabética com os números de cada cliente", async () => {
    const ana = await customer("Ana Souza", "ana@teste.com");
    await customer("Bruno Lima", "bruno@teste.com");
    const carla = await customer("Carla Dias", "carla@teste.com");
    await appointment(ana.id, "2026-10-05", "COMPLETED", 3500);
    await appointment(ana.id, "2026-10-20", "COMPLETED", 3000);
    await appointment(ana.id, "2026-10-25", "NO_SHOW");
    await appointment(carla.id, date, "SCHEDULED"); // daqui a 7 dias

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(["Ana Souza", "Bruno Lima", "Carla Dias"]);
    expect(res.body.items[0]).toMatchObject({
      completed: 2,
      noShows: 1,
      totalSpentCents: 6500,
      lastVisitAt: localDateTimeToUtc("2026-10-20", "08:30", TZ).toISOString(), // o concluído mais recente
      nextAppointmentAt: null,
    });
    expect(res.body.items[1]).toMatchObject({ completed: 0, totalSpentCents: 0, lastVisitAt: null });
    expect(res.body.items[2].nextAppointmentAt).not.toBeNull();
  });

  it.each([
    ["nome, sem diferenciar maiúsculas", "?search=SOUZA", ["Ana Souza"]],
    ["e-mail", "?search=bruno@", ["Bruno Lima"]],
    ["telefone digitado com máscara", "?search=(81)%2098888", ["Carla Dias"]],
  ])("busca por %s", async (_label, query, expected) => {
    await customer("Ana Souza", "ana@teste.com");
    await customer("Bruno Lima", "bruno@teste.com");
    await customer("Carla Dias", "carla@teste.com", "81988887777");

    const res = await list(query);

    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(expected);
  });

  it("busca sem números não casa com todos os telefones (bug clássico do contains vazio)", async () => {
    await customer("Ana Souza", "ana@teste.com");

    const res = await list("?search=xyz");

    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("pagina de 20 em 20, com ordem estável", async () => {
    for (let i = 1; i <= 25; i++) await customer(`Cliente ${String(i).padStart(2, "0")}`, `c${i}@teste.com`);

    const page1 = await list("?page=1");
    const page2 = await list("?page=2");
    const page3 = await list("?page=3");

    expect(page1.body).toMatchObject({ total: 25, totalPages: 2 });
    expect(page1.body.items).toHaveLength(20);
    expect(page2.body.items.map((c: { name: string }) => c.name)).toEqual([
      "Cliente 21",
      "Cliente 22",
      "Cliente 23",
      "Cliente 24",
      "Cliente 25",
    ]);
    expect(page3.body.items).toEqual([]); // página além do fim: lista vazia, não erro
  });

  it("recusa página inválida", async () => {
    expect((await list("?page=0")).status).toBe(400);
    expect((await list("?page=abc")).status).toBe(400);
  });
});

describe("GET /customers/:id", () => {
  it("traz os dados, os números e o histórico do mais recente para o mais antigo", async () => {
    const ana = await customer("Ana Souza", "ana@teste.com");
    await appointment(ana.id, "2026-10-05", "COMPLETED", 3500);
    await appointment(ana.id, "2026-10-20", "COMPLETED", 2500);
    await appointment(ana.id, "2026-10-25", "CANCELED");

    const res = await setup.agent.get(`/customers/${ana.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Ana Souza",
      email: "ana@teste.com",
      completed: 2,
      canceled: 1,
      totalSpentCents: 6000,
      averageTicketCents: 3000,
    });
    expect(res.body.appointments.map((a: { date: string; status: string }) => `${a.date} ${a.status}`)).toEqual([
      "2026-10-25 CANCELED",
      "2026-10-20 COMPLETED",
      "2026-10-05 COMPLETED",
    ]);
    expect(res.body.appointments[2]).toMatchObject({ time: "08:00", service: "Corte", professional: "João", priceCents: 3500 });
  });

  it("cliente inexistente: 404", async () => {
    expect((await setup.agent.get("/customers/00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});

describe("isolamento entre estabelecimentos (clientes)", () => {
  it("um dono não vê a lista nem a ficha dos clientes de outro", async () => {
    const ana = await customer("Ana Souza", "ana@teste.com");
    const outro = await createLoggedOwner(app, "Barbearia B");

    const listOther = await list("", outro.agent);
    const detailOther = await outro.agent.get(`/customers/${ana.id}`);

    expect(listOther.body.items).toEqual([]);
    expect(detailOther.status).toBe(404);
  });
});

describe("agenda", () => {
  it("devolve o id do cliente, para o painel abrir a ficha dele", async () => {
    const ana = await customer("Ana Souza", "ana@teste.com");
    await appointment(ana.id, date, "SCHEDULED");

    const res = await setup.agent.get(`/appointments?from=${date}&to=${date}`);

    expect(res.body.appointments[0].customer).toMatchObject({ id: ana.id, name: "Ana Souza" });
  });
});
