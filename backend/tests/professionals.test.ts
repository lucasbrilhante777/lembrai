import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";

const app = createApp();

type Agent = Awaited<ReturnType<typeof createLoggedOwner>>["agent"];

async function createService(agent: Agent, name = "Corte") {
  const res = await agent.post("/services").send({ name, durationMinutes: 30, priceCents: 3500 });
  return res.body.id as string;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("profissionais", () => {
  it("exige login", async () => {
    expect((await request(app).get("/professionals")).status).toBe(401);
  });

  it("cria um profissional com os serviços que ele realiza", async () => {
    const { agent } = await createLoggedOwner(app);
    const corte = await createService(agent, "Corte");
    const barba = await createService(agent, "Barba");

    const res = await agent.post("/professionals").send({ name: "João", serviceIds: [corte, barba, corte] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "João", active: true, workingHours: [] });
    expect(res.body.serviceIds.sort()).toEqual([corte, barba].sort()); // repetido entra uma vez só
  });

  it("substitui a lista de serviços no update", async () => {
    const { agent } = await createLoggedOwner(app);
    const corte = await createService(agent, "Corte");
    const barba = await createService(agent, "Barba");
    const { body: joao } = await agent.post("/professionals").send({ name: "João", serviceIds: [corte] });

    const res = await agent.patch(`/professionals/${joao.id}`).send({ serviceIds: [barba] });

    expect(res.status).toBe(200);
    expect(res.body.serviceIds).toEqual([barba]);
  });

  it("desativa um profissional", async () => {
    const { agent } = await createLoggedOwner(app);
    const { body: joao } = await agent.post("/professionals").send({ name: "João" });

    const res = await agent.patch(`/professionals/${joao.id}`).send({ active: false });

    expect(res.body.active).toBe(false);
  });
});

describe("horários de trabalho", () => {
  it("define a semana e devolve ordenada por dia e horário", async () => {
    const { agent } = await createLoggedOwner(app);
    const { body: joao } = await agent.post("/professionals").send({ name: "João" });

    const res = await agent.put(`/professionals/${joao.id}/working-hours`).send({
      workingHours: [
        { dayOfWeek: 2, startTime: "13:00", endTime: "18:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }, // intervalo de almoço
        { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.workingHours).toEqual([
      { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 2, startTime: "13:00", endTime: "18:00" },
    ]);
  });

  it("enviar de novo substitui o expediente anterior", async () => {
    const { agent } = await createLoggedOwner(app);
    const { body: joao } = await agent.post("/professionals").send({ name: "João" });
    const url = `/professionals/${joao.id}/working-hours`;
    await agent.put(url).send({ workingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }] });

    const res = await agent.put(url).send({ workingHours: [{ dayOfWeek: 3, startTime: "10:00", endTime: "16:00" }] });

    expect(res.body.workingHours).toEqual([{ dayOfWeek: 3, startTime: "10:00", endTime: "16:00" }]);
  });

  it.each([
    ["intervalos que se cruzam no mesmo dia", [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "11:00", endTime: "14:00" },
    ]],
    ["início depois do fim", [{ dayOfWeek: 1, startTime: "18:00", endTime: "09:00" }]],
    ["formato de hora inválido", [{ dayOfWeek: 1, startTime: "9h", endTime: "18:00" }]],
    ["dia da semana fora de 0–6", [{ dayOfWeek: 7, startTime: "09:00", endTime: "18:00" }]],
  ])("recusa %s com 400", async (_label, workingHours) => {
    const { agent } = await createLoggedOwner(app);
    const { body: joao } = await agent.post("/professionals").send({ name: "João" });

    const res = await agent.put(`/professionals/${joao.id}/working-hours`).send({ workingHours });

    expect(res.status).toBe(400);
  });
});

describe("isolamento entre estabelecimentos (profissionais)", () => {
  it("um dono não vê nem altera o profissional de outro", async () => {
    const donoA = await createLoggedOwner(app, "Barbearia A");
    const donoB = await createLoggedOwner(app, "Barbearia B");
    const { body: joaoA } = await donoA.agent.post("/professionals").send({ name: "João" });

    const listB = await donoB.agent.get("/professionals");
    const patchB = await donoB.agent.patch(`/professionals/${joaoA.id}`).send({ name: "Invadido" });
    const hoursB = await donoB.agent
      .put(`/professionals/${joaoA.id}/working-hours`)
      .send({ workingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }] });

    expect(listB.body).toEqual([]);
    expect(patchB.status).toBe(404);
    expect(hoursB.status).toBe(404);
    const unchanged = await prisma.professional.findUniqueOrThrow({
      where: { id: joaoA.id },
      include: { workingHours: true },
    });
    expect(unchanged.name).toBe("João");
    expect(unchanged.workingHours).toEqual([]);
  });

  it("um dono não consegue vincular ao seu profissional um serviço de outro estabelecimento", async () => {
    const donoA = await createLoggedOwner(app, "Barbearia A");
    const donoB = await createLoggedOwner(app, "Barbearia B");
    const servicoA = await createService(donoA.agent);

    const create = await donoB.agent.post("/professionals").send({ name: "Pedro", serviceIds: [servicoA] });
    const { body: pedro } = await donoB.agent.post("/professionals").send({ name: "Pedro" });
    const update = await donoB.agent.patch(`/professionals/${pedro.id}`).send({ serviceIds: [servicoA] });

    expect(create.status).toBe(400);
    expect(update.status).toBe(400);
    expect(await prisma.professionalService.count()).toBe(0);
  });
});
