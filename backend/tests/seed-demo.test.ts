import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO, seedDemo } from "../src/demo/seed-demo.js";
import { sendDueReminders } from "../src/jobs/reminders.job.js";
import { mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { addDays, dayOfWeek, localToday } from "../src/utils/zoned-date.js";
import { resetDatabase } from "./helpers/db.js";

const app = createApp();
const now = new Date();

let firstRun: Awaited<ReturnType<typeof seedDemo>>;

beforeAll(async () => {
  await resetDatabase();
  firstRun = await seedDemo(prisma, now);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.$disconnect();
});

describe("conta demo (seed)", () => {
  it("o login da demo funciona", async () => {
    const res = await request(app).post("/auth/login").send({ email: DEMO.email, password: DEMO.password });

    expect(res.status).toBe(200);
    expect(res.body.establishment.slug).toBe(DEMO.slug);
  });

  it("a página pública mostra serviços e profissionais", async () => {
    const res = await request(app).get(`/public/establishments/${DEMO.slug}`);

    expect(res.body.services).toHaveLength(4);
    expect(res.body.professionals.map((p: { name: string }) => p.name)).toEqual(["Ana", "João", "Pedro"]);
  });

  it("tem agendamentos de todos os status, com passado e futuro", async () => {
    const byStatus = await prisma.appointment.groupBy({ by: ["status"], _count: true });
    const statuses = byStatus.map((g) => g.status).sort();

    expect(firstRun.appointments).toBeGreaterThan(100);
    expect(statuses).toEqual(["CANCELED", "COMPLETED", "NO_SHOW", "SCHEDULED"]);
    expect(await prisma.appointment.count({ where: { startAt: { gt: now }, status: "SCHEDULED" } })).toBeGreaterThan(0);
  });

  it("deixa horários livres para quem testar o agendamento", async () => {
    const { body: page } = await request(app).get(`/public/establishments/${DEMO.slug}`);
    const joao = page.professionals.find((p: { name: string }) => p.name === "João");
    // Próxima terça a sábado (dias de trabalho do João), a partir de amanhã
    const today = localToday(DEMO.timezone, now);
    let date = addDays(today, 1);
    while (![2, 3, 4, 5, 6].includes(dayOfWeek(date))) date = addDays(date, 1);

    const params = new URLSearchParams({ serviceId: joao.serviceIds[0], professionalId: joao.id, date });
    const res = await request(app).get(`/public/establishments/${DEMO.slug}/availability?${params}`);

    expect(res.body.slots.length).toBeGreaterThan(0);
  });

  it("o job de lembretes nunca envia e-mail para os clientes fictícios", async () => {
    const send = vi.spyOn(mailer, "send");

    await sendDueReminders(now);

    expect(send).not.toHaveBeenCalled();
  });

  it("rodar de novo recria a demo sem duplicar nada (e gera os mesmos dados)", async () => {
    const secondRun = await seedDemo(prisma, now);

    expect(await prisma.user.count({ where: { email: DEMO.email } })).toBe(1);
    expect(await prisma.establishment.count({ where: { slug: DEMO.slug } })).toBe(1);
    expect(secondRun.appointments).toBe(firstRun.appointments);
    expect(await prisma.appointment.count()).toBe(firstRun.appointments);
  });

  it("não mexe em outras contas", async () => {
    await request(app).post("/auth/register").send({
      name: "Outro Dono",
      email: "outro@teste.com",
      password: "senha-forte-123",
      establishmentName: "Outra Barbearia",
    });

    await seedDemo(prisma, now);

    expect(await prisma.user.count({ where: { email: "outro@teste.com" } })).toBe(1);
  });
});
