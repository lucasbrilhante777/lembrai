import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderApp } from "../../test/mock-api.tsx";
import type { Professional } from "./api.ts";

const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: "America/Recife" },
};
const services = [
  { id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3500, active: true },
  { id: "s2", name: "Barba", durationMinutes: 20, priceCents: 2500, active: true },
];

/** API "com memória" de profissionais. */
function professionalsApi(initial: Professional[], workingHoursReply?: { status: number; body: unknown }) {
  let professionals = [...initial];
  return mockApi({
    "GET /auth/me": { status: 200, body: session },
    "GET /services": { status: 200, body: services },
    "GET /professionals": () => ({ status: 200, body: professionals }),
    "POST /professionals": (body) => {
      const created = { id: "p-new", active: true, workingHours: [], ...(body as { name: string; serviceIds: string[] }) };
      professionals = [...professionals, created];
      return { status: 201, body: created };
    },
    "PUT /professionals/*": (body, url) => {
      if (workingHoursReply) return workingHoursReply;
      const id = url.pathname.split("/").at(-2)!;
      const { workingHours } = body as { workingHours: Professional["workingHours"] };
      professionals = professionals.map((p) => (p.id === id ? { ...p, workingHours } : p));
      return { status: 200, body: professionals.find((p) => p.id === id) };
    },
  });
}

const joao: Professional = { id: "p1", name: "João", active: true, serviceIds: ["s1"], workingHours: [] };

describe("tela de profissionais", () => {
  it("cria um profissional com os serviços marcados e já abre os horários", async () => {
    const fetchMock = professionalsApi([]);
    const user = userEvent.setup();
    renderApp("/painel/profissionais");

    await user.click(await screen.findByRole("button", { name: "Novo profissional" }));
    await user.type(screen.getByLabelText("Nome"), "Ana");
    await user.click(screen.getByRole("checkbox", { name: "Barba" }));
    await user.click(screen.getByRole("button", { name: "Criar profissional" }));

    expect(await screen.findByRole("heading", { name: "Horários de Ana" })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ name: "Ana", serviceIds: ["s2"] });
  });

  it("define os horários (com intervalo de almoço) e mostra o resumo", async () => {
    const fetchMock = professionalsApi([joao]);
    const user = userEvent.setup();
    renderApp("/painel/profissionais");

    const row = await screen.findByRole("article", { name: "João" });
    expect(within(row).getByText("Sem expediente cadastrado")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Horários" }));

    // Segunda: 09:00–18:00 (padrão) + segundo intervalo; ajusta para 09–12 e 13–18.
    await user.click(screen.getByRole("button", { name: "Adicionar intervalo em Segunda" }));
    await user.clear(screen.getByLabelText("Segunda: fim do intervalo 1"));
    await user.type(screen.getByLabelText("Segunda: fim do intervalo 1"), "12:00");
    await user.click(screen.getByRole("button", { name: "Adicionar intervalo em Segunda" }));
    await user.clear(screen.getByLabelText("Segunda: início do intervalo 2"));
    await user.type(screen.getByLabelText("Segunda: início do intervalo 2"), "13:00");
    await user.type(screen.getByLabelText("Segunda: fim do intervalo 2"), "18:00");
    await user.click(screen.getByRole("button", { name: "Copiar para terça a sexta" }));
    await user.click(screen.getByRole("button", { name: "Salvar horários" }));

    const updated = await screen.findByRole("article", { name: "João" });
    expect(within(updated).getByText("Seg a Sex: 09:00–12:00, 13:00–18:00")).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(put[1]!.body as string).workingHours).toHaveLength(10); // 5 dias x 2 intervalos
  });

  it("não envia horários inválidos e diz qual dia está errado", async () => {
    const fetchMock = professionalsApi([joao]);
    const user = userEvent.setup();
    renderApp("/painel/profissionais");

    const row = await screen.findByRole("article", { name: "João" });
    await user.click(within(row).getByRole("button", { name: "Horários" }));
    await user.click(screen.getByRole("button", { name: "Adicionar intervalo em Terça" }));
    await user.click(screen.getByRole("button", { name: "Adicionar intervalo em Terça" }));
    await user.type(screen.getByLabelText("Terça: fim do intervalo 2"), "17:00"); // começa 18:00, termina 17:00
    await user.click(screen.getByRole("button", { name: "Salvar horários" }));

    expect(screen.getByText("O início precisa ser antes do fim.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("mostra o erro da API se ela recusar os horários", async () => {
    professionalsApi([joao], { status: 400, body: { message: "Dados inválidos.", issues: [] } });
    const user = userEvent.setup();
    renderApp("/painel/profissionais");

    const row = await screen.findByRole("article", { name: "João" });
    await user.click(within(row).getByRole("button", { name: "Horários" }));
    await user.click(screen.getByRole("button", { name: "Adicionar intervalo em Quarta" }));
    await user.click(screen.getByRole("button", { name: "Salvar horários" }));

    expect(await screen.findByText("Dados inválidos.")).toBeInTheDocument();
  });
});
