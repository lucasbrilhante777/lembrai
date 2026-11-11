import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderApp } from "../../test/mock-api.tsx";
import type { Service } from "./api.ts";

const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: "America/Recife" },
};

/** API "com memória": o POST/PATCH muda a lista que o GET devolve, como a API real. */
function servicesApi(initial: Service[]) {
  let services = [...initial];
  const fetchMock = mockApi({
    "GET /auth/me": { status: 200, body: session },
    "GET /services": () => ({ status: 200, body: services }),
    "POST /services": (body) => {
      const created = { id: `s${services.length + 1}`, active: true, ...(body as Omit<Service, "id" | "active">) };
      services = [...services, created];
      return { status: 201, body: created };
    },
    "PATCH /services/*": (body, url) => {
      const id = url.pathname.split("/").at(-1)!;
      services = services.map((s) => (s.id === id ? { ...s, ...(body as Partial<Service>) } : s));
      return { status: 200, body: services.find((s) => s.id === id) };
    },
  });
  return fetchMock;
}

const corte: Service = { id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3500, active: true };

describe("tela de serviços", () => {
  it("lista os serviços com duração e preço", async () => {
    servicesApi([corte]);
    renderApp("/painel/servicos");

    const row = await screen.findByRole("article", { name: "Corte" });
    expect(within(row).getByText(/30 min · R\$\s35,00/)).toBeInTheDocument();
  });

  it("cria um serviço convertendo o preço digitado para centavos", async () => {
    const fetchMock = servicesApi([]);
    const user = userEvent.setup();
    renderApp("/painel/servicos");

    await user.click(await screen.findByRole("button", { name: "Novo serviço" }));
    await user.type(screen.getByLabelText("Nome do serviço"), "Barba");
    await user.clear(screen.getByLabelText("Duração (minutos)"));
    await user.type(screen.getByLabelText("Duração (minutos)"), "20");
    await user.type(screen.getByLabelText("Preço (R$)"), "25,50");
    await user.click(screen.getByRole("button", { name: "Criar serviço" }));

    expect(await screen.findByRole("article", { name: "Barba" })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ name: "Barba", durationMinutes: 20, priceCents: 2550 });
  });

  it("avisa quando o preço é inválido, sem chamar a API", async () => {
    const fetchMock = servicesApi([]);
    const user = userEvent.setup();
    renderApp("/painel/servicos");

    await user.click(await screen.findByRole("button", { name: "Novo serviço" }));
    await user.type(screen.getByLabelText("Nome do serviço"), "Barba");
    await user.type(screen.getByLabelText("Preço (R$)"), "vinte reais");
    await user.click(screen.getByRole("button", { name: "Criar serviço" }));

    expect(screen.getByText('Use um valor como "35,00".')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("edita o preço de um serviço", async () => {
    servicesApi([corte]);
    const user = userEvent.setup();
    renderApp("/painel/servicos");

    const row = await screen.findByRole("article", { name: "Corte" });
    await user.click(within(row).getByRole("button", { name: "Editar" }));
    const price = screen.getByLabelText("Preço (R$)");
    expect(price).toHaveValue("35,00");
    await user.clear(price);
    await user.type(price, "40");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const updated = await screen.findByRole("article", { name: "Corte" });
    expect(within(updated).getByText(/R\$\s40,00/)).toBeInTheDocument();
  });

  it("desativa em vez de apagar", async () => {
    servicesApi([corte]);
    const user = userEvent.setup();
    renderApp("/painel/servicos");

    const row = await screen.findByRole("article", { name: "Corte" });
    await user.click(within(row).getByRole("button", { name: "Desativar" }));

    expect(await screen.findByText("(inativo)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
  });
});
