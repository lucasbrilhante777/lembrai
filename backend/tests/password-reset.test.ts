import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { type EmailMessage, mailer } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { hashResetToken } from "../src/services/password-reset.service.js";
import { resetDatabase } from "./helpers/db.js";

// "Esqueci minha senha": pedir o link por e-mail e trocar a senha com ele.

const app = createApp();
const owner = { email: "dona@teste.com", password: "senha-antiga-123" };
const NEW_PASSWORD = "senha-nova-456";

beforeEach(async () => {
  await resetDatabase();
  await request(app).post("/auth/register").send({
    name: "Dona Teste",
    email: owner.email,
    password: owner.password,
    establishmentName: "Salão Teste",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Pede o link e devolve o token que foi no e-mail. */
async function requestResetToken(email = owner.email) {
  const send = vi.spyOn(mailer, "send");
  await request(app).post("/auth/forgot-password").send({ email });

  // O envio não é aguardado pela rota (ver o serviço), então esperamos ele acontecer.
  await vi.waitFor(() => expect(send).toHaveBeenCalled());
  const message = send.mock.calls.at(-1)?.[0] as EmailMessage;
  const token = message.text.match(/\/redefinir-senha\/([\w-]+)/)?.[1];
  if (!token) throw new Error("Token não encontrado no e-mail");
  send.mockClear();
  return { token, message };
}

function resetPassword(token: string, password = NEW_PASSWORD) {
  return request(app).post("/auth/reset-password").send({ token, password });
}

function login(password: string) {
  return request(app).post("/auth/login").send({ email: owner.email, password });
}

describe("POST /auth/forgot-password", () => {
  it("manda um e-mail com o link para quem tem conta", async () => {
    const { message } = await requestResetToken();

    expect(message.to).toBe(owner.email);
    expect(message.text).toContain("http://localhost:5173/redefinir-senha/");
  });

  it("responde igual para e-mail sem conta, e não manda nada", async () => {
    const send = vi.spyOn(mailer, "send");

    const existing = await request(app).post("/auth/forgot-password").send({ email: owner.email });
    const unknown = await request(app).post("/auth/forgot-password").send({ email: "ninguem@teste.com" });

    expect(unknown.status).toBe(existing.status);
    expect(unknown.body).toEqual(existing.body);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it("guarda só o hash do token, nunca o token em si", async () => {
    const { token } = await requestResetToken();

    const saved = await prisma.passwordResetToken.findFirstOrThrow();
    expect(saved.tokenHash).not.toBe(token);
    expect(saved.tokenHash).toBe(hashResetToken(token));
  });

  it("se o envio do e-mail falhar, a resposta continua a mesma", async () => {
    vi.spyOn(mailer, "send").mockRejectedValue(new Error("SMTP fora do ar"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).post("/auth/forgot-password").send({ email: owner.email });

    expect(res.status).toBe(202);
  });

  it("recusa e-mail inválido com 400", async () => {
    const res = await request(app).post("/auth/forgot-password").send({ email: "nao-e-email" });

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/reset-password", () => {
  it("troca a senha: a nova funciona e a antiga não", async () => {
    const { token } = await requestResetToken();

    const res = await resetPassword(token);

    expect(res.status).toBe(204);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect((await login(owner.password)).status).toBe(401);
  });

  it("o link só funciona uma vez", async () => {
    const { token } = await requestResetToken();
    await resetPassword(token);

    const second = await resetPassword(token, "outra-senha-789");

    expect(second.status).toBe(400);
    expect(second.body.code).toBe("INVALID_RESET_TOKEN");
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it("duas trocas ao mesmo tempo com o mesmo link: só uma passa", async () => {
    const { token } = await requestResetToken();

    const results = await Promise.all([resetPassword(token, "senha-um-1111"), resetPassword(token, "senha-dois-2222")]);

    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
  });

  it("link expirado não funciona", async () => {
    const { token } = await requestResetToken();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await resetPassword(token);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_RESET_TOKEN");
    expect((await login(owner.password)).status).toBe(200);
  });

  it("pedir um link novo invalida o anterior", async () => {
    const { token: first } = await requestResetToken();
    const { token: second } = await requestResetToken();

    expect((await resetPassword(first)).status).toBe(400);
    expect((await resetPassword(second)).status).toBe(204);
  });

  it("token inventado: 400 com código", async () => {
    const res = await resetPassword("token-que-nao-existe");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("aplica as mesmas regras de senha do cadastro", async () => {
    const { token } = await requestResetToken();

    const res = await resetPassword(token, "curta");

    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe("password");
    // O token não foi gasto: dá para tentar de novo com uma senha válida.
    expect((await resetPassword(token)).status).toBe(204);
  });
});

describe("trocar a senha derruba as sessões antigas", () => {
  it("quem estava logado com a senha antiga recebe 401", async () => {
    const oldSession = request.agent(app);
    await oldSession.post("/auth/login").send(owner);
    expect((await oldSession.get("/auth/me")).status).toBe(200);

    const { token } = await requestResetToken();
    await resetPassword(token);

    expect((await oldSession.get("/auth/me")).status).toBe(401);
  });

  it("um login novo, depois da troca, funciona normalmente", async () => {
    const { token } = await requestResetToken();
    await resetPassword(token);

    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email: owner.email, password: NEW_PASSWORD });

    expect((await agent.get("/auth/me")).status).toBe(200);
  });
});
