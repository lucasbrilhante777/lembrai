import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { resetDatabase } from "./helpers/db.js";

// Testa a regra do ADR 0001 direto no banco: mesmo que a API tenha um bug,
// o Postgres não deixa dois agendamentos do mesmo profissional se cruzarem.

let ids: { establishmentId: string; professionalId: string; serviceId: string; customerId: string };

beforeEach(async () => {
  await resetDatabase();

  const user = await prisma.user.create({
    data: { name: "Dono", email: "dono@teste.com", passwordHash: "x" },
  });
  const establishment = await prisma.establishment.create({
    data: { name: "Barbearia Teste", slug: "barbearia-teste", timezone: "America/Recife", userId: user.id },
  });
  const professional = await prisma.professional.create({
    data: { name: "João", establishmentId: establishment.id },
  });
  const service = await prisma.service.create({
    data: { name: "Corte", durationMinutes: 60, priceCents: 3500, establishmentId: establishment.id },
  });
  const customer = await prisma.customer.create({
    data: { name: "Maria", email: "maria@teste.com", phone: "81999999999", establishmentId: establishment.id },
  });

  ids = {
    establishmentId: establishment.id,
    professionalId: professional.id,
    serviceId: service.id,
    customerId: customer.id,
  };
});

afterAll(async () => {
  await prisma.$disconnect();
});

function book(startIso: string, endIso: string, overrides: { professionalId?: string; status?: "CANCELED" } = {}) {
  return prisma.appointment.create({
    data: {
      ...ids,
      ...overrides,
      startAt: new Date(startIso),
      endAt: new Date(endIso),
      priceCentsAtBooking: 3500,
      cancelToken: randomUUID(),
    },
  });
}

describe("regra anti-sobreposição de agendamentos", () => {
  it("recusa um agendamento que se cruza com outro do mesmo profissional", async () => {
    await book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z");

    await expect(book("2026-11-10T12:30:00Z", "2026-11-10T13:30:00Z")).rejects.toThrow(/Appointment_no_overlap/);
  });

  it("aceita um agendamento que começa exatamente quando o anterior termina", async () => {
    await book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z");

    await expect(book("2026-11-10T13:00:00Z", "2026-11-10T14:00:00Z")).resolves.toBeDefined();
  });

  it("libera o horário de um agendamento cancelado", async () => {
    await book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z", { status: "CANCELED" });

    await expect(book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z")).resolves.toBeDefined();
  });

  it("permite o mesmo horário para profissionais diferentes", async () => {
    const other = await prisma.professional.create({
      data: { name: "Pedro", establishmentId: ids.establishmentId },
    });
    await book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z");

    await expect(
      book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z", { professionalId: other.id }),
    ).resolves.toBeDefined();
  });

  it("com dois pedidos simultâneos para o mesmo horário, só um é salvo", async () => {
    const results = await Promise.allSettled([
      book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z"),
      book("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("recusa um agendamento que termina antes de começar", async () => {
    await expect(book("2026-11-10T13:00:00Z", "2026-11-10T12:00:00Z")).rejects.toThrow(/Appointment_end_after_start/);
  });
});
