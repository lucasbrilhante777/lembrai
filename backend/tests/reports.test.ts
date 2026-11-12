import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { localDateTimeToUtc } from "../src/utils/zoned-date.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, TZ, setupEstablishment } from "./helpers/establishment.js";

// Os números esperados foram calculados à mão a partir dos agendamentos criados no beforeEach.

const app = createApp();
let setup: EstablishmentSetup;

type Status = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

async function appointment(o: {
  date: string;
  time: string;
  status: Status;
  priceCents: number;
  professionalId?: string;
  serviceId?: string;
}) {
  const customer = await prisma.customer.upsert({
    where: { establishmentId_email: { establishmentId: setup.establishmentId, email: "maria@teste.com" } },
    create: { name: "Maria", email: "maria@teste.com", phone: "81999999999", establishmentId: setup.establishmentId },
    update: {},
  });
  const startAt = localDateTimeToUtc(o.date, o.time, TZ);
  await prisma.appointment.create({
    data: {
      establishmentId: setup.establishmentId,
      professionalId: o.professionalId ?? setup.professionalId,
      serviceId: o.serviceId ?? setup.serviceId,
      customerId: customer.id,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      priceCentsAtBooking: o.priceCents,
      status: o.status,
      cancelToken: randomBytes(16).toString("hex"),
    },
  });
}

const summary = (from: string, to: string, agent = setup.agent) => agent.get(`/reports/summary?from=${from}&to=${to}`);

beforeEach(async () => {
  await resetDatabase();
  setup = await setupEstablishment(app); // João faz "Corte" (R$ 35,00 hoje)
  const pedro = await prisma.professional.create({ data: { name: "Pedro", establishmentId: setup.establishmentId } });
  const barba = await prisma.service.create({
    data: { name: "Barba", durationMinutes: 20, priceCents: 2500, establishmentId: setup.establishmentId },
  });

  // Outubro de 2026
  await appointment({ date: "2026-10-05", time: "09:00", status: "COMPLETED", priceCents: 3500 }); // João, Corte
  await appointment({ date: "2026-10-05", time: "10:00", status: "COMPLETED", priceCents: 2500, professionalId: pedro.id, serviceId: barba.id });
  // Preço salvo no agendamento (R$ 30,00) diferente do preço atual do serviço (R$ 35,00): vale o salvo.
  await appointment({ date: "2026-10-06", time: "09:00", status: "COMPLETED", priceCents: 3000 });
  await appointment({ date: "2026-10-07", time: "09:00", status: "NO_SHOW", priceCents: 3500 });
  await appointment({ date: "2026-10-08", time: "09:00", status: "CANCELED", priceCents: 3500 });
  await appointment({ date: "2026-10-09", time: "09:00", status: "SCHEDULED", priceCents: 3500 });
  // Período anterior (31/08 a 30/09)
  await appointment({ date: "2026-09-15", time: "09:00", status: "COMPLETED", priceCents: 4000 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /reports/summary", () => {
  it("exige login", async () => {
    expect((await request(app).get("/reports/summary?from=2026-10-01&to=2026-10-31")).status).toBe(401);
  });

  it("calcula os totais: receita só dos concluídos, pelo preço salvo no agendamento", async () => {
    const res = await summary("2026-10-01", "2026-10-31");

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      revenueCents: 9000, // 3500 + 2500 + 3000
      completed: 3,
      noShows: 1,
      canceled: 1,
      scheduled: 1,
      averageTicketCents: 3000, // 9000 / 3
      noShowRate: 0.25, // 1 falta / (3 concluídos + 1 falta)
    });
  });

  it("compara com o período anterior de mesmo tamanho", async () => {
    const res = await summary("2026-10-01", "2026-10-31"); // 31 dias -> 31/08 a 30/09

    expect(res.body.previous).toEqual({ from: "2026-08-31", to: "2026-09-30", revenueCents: 4000, completed: 1 });
  });

  it("agrupa por serviço e por profissional, do maior para o menor", async () => {
    const res = await summary("2026-10-01", "2026-10-31");

    expect(res.body.byService).toEqual([
      { id: setup.serviceId, name: "Corte", completed: 2, revenueCents: 6500 },
      { id: expect.any(String), name: "Barba", completed: 1, revenueCents: 2500 },
    ]);
    expect(res.body.byProfessional).toEqual([
      { id: setup.professionalId, name: "João", completed: 2, noShows: 1, revenueCents: 6500 },
      { id: expect.any(String), name: "Pedro", completed: 1, noShows: 0, revenueCents: 2500 },
    ]);
  });

  it("traz a receita de todos os dias do período, inclusive os sem movimento", async () => {
    const res = await summary("2026-10-01", "2026-10-31");

    expect(res.body.byDay).toHaveLength(31);
    expect(res.body.byDay[0]).toEqual({ date: "2026-10-01", revenueCents: 0, completed: 0 });
    expect(res.body.byDay.find((d: { date: string }) => d.date === "2026-10-05")).toEqual({
      date: "2026-10-05",
      revenueCents: 6000,
      completed: 2,
    });
  });

  it("usa o dia local: 23:30 em Recife (02:30 UTC do dia seguinte) conta no dia certo", async () => {
    await appointment({ date: "2026-10-20", time: "23:30", status: "COMPLETED", priceCents: 5000 });

    const res = await summary("2026-10-20", "2026-10-20");

    expect(res.body.totals.revenueCents).toBe(5000);
    expect(res.body.byDay).toEqual([{ date: "2026-10-20", revenueCents: 5000, completed: 1 }]);
  });

  it("período sem atendimentos não quebra as contas (sem divisão por zero)", async () => {
    const res = await summary("2027-01-01", "2027-01-31");

    expect(res.body.totals).toMatchObject({ revenueCents: 0, completed: 0, averageTicketCents: 0, noShowRate: null });
  });

  it.each([
    ["data final antes da inicial", "2026-10-31", "2026-10-01"],
    ["mais de um ano", "2026-01-01", "2027-06-01"],
  ])("recusa %s com 400", async (_label, from, to) => {
    expect((await summary(from, to)).status).toBe(400);
  });

  it("um dono não vê o faturamento de outro", async () => {
    const outro = await createLoggedOwner(app, "Barbearia B");

    const res = await summary("2026-10-01", "2026-10-31", outro.agent);

    expect(res.body.totals.revenueCents).toBe(0);
    expect(res.body.byService).toEqual([]);
    expect(res.body.byProfessional).toEqual([]);
  });
});
