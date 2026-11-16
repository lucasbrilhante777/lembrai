import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { calls, mockApi, renderApp } from "../../test/mock-api.tsx";

const GENERIC = "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha.";

describe("esqueci minha senha", () => {
  it("o login tem o link para a tela de recuperar", async () => {
    mockApi({ "GET /auth/me": { status: 401 } });
    const user = userEvent.setup();
    renderApp("/entrar");

    await user.click(await screen.findByRole("link", { name: "Esqueci minha senha" }));

    expect(await screen.findByRole("heading", { name: "Esqueci minha senha" })).toBeInTheDocument();
  });

  it("envia o e-mail e mostra a mensagem da API", async () => {
    const fetchMock = mockApi({ "POST /auth/forgot-password": { status: 202, body: { message: GENERIC } } });
    const user = userEvent.setup();
    renderApp("/esqueci-senha");

    await user.type(screen.getByLabelText("E-mail"), "dona@teste.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    expect(calls(fetchMock)).toEqual(["POST /auth/forgot-password"]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ email: "dona@teste.com" }));
  });

  it("e-mail inválido aparece no campo", async () => {
    mockApi({
      "POST /auth/forgot-password": {
        status: 400,
        body: { message: "Dados inválidos.", issues: [{ path: "email", message: "E-mail inválido." }] },
      },
    });
    const user = userEvent.setup();
    renderApp("/esqueci-senha");

    await user.type(screen.getByLabelText("E-mail"), "nao-e-email");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByText("E-mail inválido.")).toBeInTheDocument();
  });
});

describe("criar nova senha (link do e-mail)", () => {
  it("abrir a página não faz nada; salvar manda o token e a senha", async () => {
    const fetchMock = mockApi({ "POST /auth/reset-password": { status: 204 } });
    const user = userEvent.setup();
    renderApp("/redefinir-senha/tok123");

    expect(calls(fetchMock)).toEqual([]);

    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-456");
    await user.type(screen.getByLabelText("Repita a nova senha"), "senha-nova-456");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ token: "tok123", password: "senha-nova-456" }));
    expect(screen.getByRole("link", { name: "Entrar com a nova senha" })).toHaveAttribute("href", "/entrar");
  });

  it("senhas diferentes: avisa e nem chama a API", async () => {
    const fetchMock = mockApi({});
    const user = userEvent.setup();
    renderApp("/redefinir-senha/tok123");

    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-456");
    await user.type(screen.getByLabelText("Repita a nova senha"), "senha-nova-457");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(screen.getByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(calls(fetchMock)).toEqual([]);
  });

  it("link vencido ou já usado oferece pedir um novo", async () => {
    mockApi({
      "POST /auth/reset-password": {
        status: 400,
        body: { message: "Este link de redefinição é inválido ou já expirou. Peça um novo.", code: "INVALID_RESET_TOKEN" },
      },
    });
    const user = userEvent.setup();
    renderApp("/redefinir-senha/tok-velho");

    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-456");
    await user.type(screen.getByLabelText("Repita a nova senha"), "senha-nova-456");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("link", { name: "Pedir um novo link" })).toHaveAttribute("href", "/esqueci-senha");
  });

  it("senha fraca aparece no campo, vinda da API", async () => {
    mockApi({
      "POST /auth/reset-password": {
        status: 400,
        body: {
          message: "Dados inválidos.",
          issues: [{ path: "password", message: "A senha precisa ter pelo menos 8 caracteres." }],
        },
      },
    });
    const user = userEvent.setup();
    renderApp("/redefinir-senha/tok123");

    await user.type(screen.getByLabelText("Nova senha"), "curta");
    await user.type(screen.getByLabelText("Repita a nova senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
  });
});
