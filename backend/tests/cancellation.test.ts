import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { insertAppointment } from "./helpers/appointments.js";
import { resetDatabase } from "./helpers/db.js";
import { type EstablishmentSetup, at, date, setupEstablishment } from "./helpers/establishment.js";

const app = createApp();

async function freeTimes(setup: EstablishmentSetup) {
  const params = new URLSearchParams({ serviceId: setup.serviceId, professionalId: setup.professionalId, date });
  const res = await request(app).get(`/public/establishments/${setup.slug}/availability?${params}`);
  return res.body.slots.map((s: { time: string }) => s.time) as string[];
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cancelamento pelo link do e-mail", () => {
  it("GET mostra o agendamento sem cancelar (protege contra leitores de e-mail que abrem links)", async () => {
    const setup = await setupEstablishment(app);
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });

    const res = await request(app).get(`/public/appointments/${appointment.cancelToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "SCHEDULED",
      date,
      time: "09:00",
      establishment: { name: "Barbearia Teste" },
      service: { name: "Corte" },
      professional: { name: "João" },
    });
    expect(res.body).not.toHaveProperty("customer"); // nada de dados pessoais na página
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(saved.status).toBe("SCHEDULED");
  });

  it("POST cancela e o horário volta a ficar livre", async () => {
    const setup = await setupEstablishment(app);
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });
    expect(await freeTimes(setup)).not.toContain("09:00");

    const res = await request(app).post(`/public/appointments/${appointment.cancelToken}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELED");
    expect(await freeTimes(setup)).toContain("09:00");
  });

  it("cancelar de novo não é erro", async () => {
    const setup = await setupEstablishment(app);
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")) });
    const url = `/public/appointments/${appointment.cancelToken}/cancel`;

    await request(app).post(url);
    const again = await request(app).post(url);

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("CANCELED");
  });

  it("não cancela agendamento que já passou", async () => {
    const setup = await setupEstablishment(app);
    const appointment = await insertAppointment(setup, { startAt: new Date(Date.now() - 60 * 60_000) });

    const res = await request(app).post(`/public/appointments/${appointment.cancelToken}/cancel`);

    expect(res.status).toBe(409);
  });

  it("não cancela agendamento já concluído", async () => {
    const setup = await setupEstablishment(app);
    const appointment = await insertAppointment(setup, { startAt: new Date(at("09:00")), status: "COMPLETED" });

    const res = await request(app).post(`/public/appointments/${appointment.cancelToken}/cancel`);

    expect(res.status).toBe(409);
  });

  it("token inexistente responde 404", async () => {
    expect((await request(app).get("/public/appointments/token-que-nao-existe")).status).toBe(404);
    expect((await request(app).post("/public/appointments/token-que-nao-existe/cancel")).status).toBe(404);
  });
});
