import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDatabase } from "./helpers/db.js";

const app = createApp();

const validRegister = {
  name: "Lucas",
  email: "lucas@teste.com",
  password: "senha-forte-123",
  establishmentName: "Barbearia do Zé",
  timezone: "America/Recife",
};

function getAuthCookie(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return cookies.find((c) => c.startsWith("lembrai_token="));
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("cria o dono e o estabelecimento e já deixa logado", async () => {
    const res = await request(app).post("/auth/register").send(validRegister);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Lucas", email: "lucas@teste.com" });
    expect(res.body.establishment).toMatchObject({
      name: "Barbearia do Zé",
      slug: "barbearia-do-ze",
      timezone: "America/Recife",
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const cookie = getAuthCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("guarda a senha como hash, nunca em texto puro", async () => {
    await request(app).post("/auth/register").send(validRegister);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "lucas@teste.com" } });
    expect(user.passwordHash).not.toBe(validRegister.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // formato bcrypt
  });

  it("normaliza o e-mail (espaços e maiúsculas)", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validRegister, email: "  Lucas@Teste.COM " });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("lucas@teste.com");
  });

  it("recusa e-mail já cadastrado com 409", async () => {
    await request(app).post("/auth/register").send(validRegister);
    const res = await request(app).post("/auth/register").send(validRegister);

    expect(res.status).toBe(409);
  });

  it("gera um slug diferente quando o nome do estabelecimento já existe", async () => {
    await request(app).post("/auth/register").send(validRegister);
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validRegister, email: "outro@teste.com" });

    expect(res.status).toBe(201);
    expect(res.body.establishment.slug).toMatch(/^barbearia-do-ze-\d{4}$/);
  });

  it("recusa dados inválidos com 400 e diz o que está errado", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validRegister, email: "nao-e-email", password: "123", timezone: "America/Recif" });

    expect(res.status).toBe(400);
    const paths = res.body.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "password", "timezone"]));
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/register").send(validRegister);
  });

  it("loga com e-mail e senha corretos", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "lucas@teste.com", password: "senha-forte-123" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("lucas@teste.com");
    expect(getAuthCookie(res)).toBeDefined();
  });

  it("responde a mesma mensagem para senha errada e para e-mail inexistente", async () => {
    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "lucas@teste.com", password: "senha-errada" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "ninguem@teste.com", password: "senha-forte-123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(getAuthCookie(wrongPassword)).toBeUndefined();
  });
});

describe("sessão (GET /auth/me e POST /auth/logout)", () => {
  it("sem cookie, responde 401", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
  });

  it("com token adulterado, responde 401", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", "lembrai_token=token.falso.qualquer");

    expect(res.status).toBe(401);
  });

  it("depois do login, devolve o dono e o estabelecimento", async () => {
    // O agent guarda os cookies entre as requisições, como um navegador.
    const agent = request.agent(app);
    await agent.post("/auth/register").send(validRegister);

    const res = await agent.get("/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("lucas@teste.com");
    expect(res.body.establishment.slug).toBe("barbearia-do-ze");
  });

  it("depois do logout, a sessão acaba", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/register").send(validRegister);

    const logout = await agent.post("/auth/logout");
    const me = await agent.get("/auth/me");

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
  });
});
