import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createLoggedOwner } from "./helpers/auth.js";
import { resetDatabase } from "./helpers/db.js";

const app = createApp();
const corte = { name: "Corte", durationMinutes: 30, priceCents: 3500 };

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("serviços", () => {
  it("exige login", async () => {
    expect((await request(app).get("/services")).status).toBe(401);
    expect((await request(app).post("/services").send(corte)).status).toBe(401);
  });

  it("cria e lista serviços do estabelecimento", async () => {
    const { agent } = await createLoggedOwner(app);

    const created = await agent.post("/services").send(corte);
    const list = await agent.get("/services");

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...corte, active: true });
    expect(list.body).toEqual([created.body]);
  });

  it("recusa duração e preço inválidos", async () => {
    const { agent } = await createLoggedOwner(app);

    const res = await agent.post("/services").send({ name: "Corte", durationMinutes: 0, priceCents: -100 });

    expect(res.status).toBe(400);
    const paths = res.body.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["durationMinutes", "priceCents"]));
  });

  it("atualiza e desativa um serviço", async () => {
    const { agent } = await createLoggedOwner(app);
    const { body: service } = await agent.post("/services").send(corte);

    const res = await agent.patch(`/services/${service.id}`).send({ priceCents: 4000, active: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ priceCents: 4000, active: false });
  });

  it("responde 404 para id inexistente", async () => {
    const { agent } = await createLoggedOwner(app);

    const res = await agent.patch("/services/00000000-0000-4000-8000-000000000000").send({ priceCents: 1 });

    expect(res.status).toBe(404);
  });
});

describe("isolamento entre estabelecimentos (serviços)", () => {
  it("um dono não vê os serviços de outro", async () => {
    const donoA = await createLoggedOwner(app, "Barbearia A");
    const donoB = await createLoggedOwner(app, "Barbearia B");
    await donoA.agent.post("/services").send(corte);

    const listB = await donoB.agent.get("/services");

    expect(listB.body).toEqual([]);
  });

  it("um dono não altera o serviço de outro, mesmo sabendo o id", async () => {
    const donoA = await createLoggedOwner(app, "Barbearia A");
    const donoB = await createLoggedOwner(app, "Barbearia B");
    const { body: serviceA } = await donoA.agent.post("/services").send(corte);

    const res = await donoB.agent.patch(`/services/${serviceA.id}`).send({ priceCents: 1 });

    expect(res.status).toBe(404);
    const unchanged = await prisma.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(unchanged.priceCents).toBe(3500);
  });
});
