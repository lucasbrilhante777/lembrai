import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { localToday } from "../../lib/format.ts";
import { mockApi, renderApp } from "../../test/mock-api.tsx";
import type { CustomerDetail, CustomerListItem } from "./api.ts";

const TZ = "America/Recife";
const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: TZ },
};

const ana: CustomerListItem = {
  id: "c1",
  name: "Ana Souza",
  email: "ana@example.com",
  phone: "81988887777",
  completed: 2,
  noShows: 1,
  canceled: 0,
  totalSpentCents: 6500,
  lastVisitAt: "2026-10-20T11:00:00.000Z", // 08:00 em Recife
  nextAppointmentAt: null,
};
const bruno: CustomerListItem = { ...ana, id: "c2", name: "Bruno Lima", email: "bruno@example.com", completed: 0, noShows: 0, totalSpentCents: 0, lastVisitAt: null };

/** API da lista: filtra pela busca e pagina de 1 em 1 (para testar a paginação com poucos itens). */
function listApi() {
  return mockApi({
    "GET /auth/me": { status: 200, body: session },
    "GET /customers": (_body, url) => {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const page = Number(url.searchParams.get("page"));
      const all = [ana, bruno].filter((c) => c.name.toLowerCase().includes(search));
      return { status: 200, body: { items: all.slice(page - 1, page), page, pageSize: 1, total: all.length, totalPages: Math.max(1, all.length) } };
    },
  });
}

const customerCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/customers?"));

describe("lista de clientes", () => {
  it("mostra visitas, faltas, total gasto e a última visita no fuso do estabelecimento", async () => {
    listApi();
    renderApp("/painel/clientes");

    const row = (await screen.findByRole("link", { name: "Ana Souza" })).closest("tr")!;
    expect(within(row).getByText("(81) 98888-7777 · ana@example.com")).toBeInTheDocument();
    expect(within(row).getByText(/R\$\s65,00/)).toBeInTheDocument();
    expect(within(row).getByText("20/10/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ana Souza" })).toHaveAttribute("href", "/painel/clientes/c1");
  });

  it("pagina com Anterior/Próxima", async () => {
    listApi();
    const user = userEvent.setup();
    renderApp("/painel/clientes");

    await screen.findByRole("link", { name: "Ana Souza" });
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Próxima" }));

    expect(await screen.findByRole("link", { name: "Bruno Lima" })).toBeInTheDocument();
    expect(screen.getByText("2 cliente(s) · página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("busca espera a pessoa parar de digitar (uma chamada só) e volta para a página 1", async () => {
    const fetchMock = listApi();
    const user = userEvent.setup();
    renderApp("/painel/clientes");
    await screen.findByRole("link", { name: "Ana Souza" });
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByRole("link", { name: "Bruno Lima" });
    const before = customerCalls(fetchMock).length;

    await user.type(screen.getByLabelText("Buscar cliente"), "bruno");

    expect(await screen.findByText("1 cliente(s) · página 1 de 1")).toBeInTheDocument();
    const searches = customerCalls(fetchMock).slice(before);
    expect(searches).toEqual(["/api/customers?page=1&search=bruno"]); // e não b, br, bru, brun, bruno
  });

  it("busca sem resultado explica o que aconteceu", async () => {
    listApi();
    const user = userEvent.setup();
    renderApp("/painel/clientes");
    await screen.findByRole("link", { name: "Ana Souza" });

    await user.type(screen.getByLabelText("Buscar cliente"), "zzz");

    expect(await screen.findByText('Nenhum cliente encontrado para "zzz".')).toBeInTheDocument();
  });
});

describe("ficha do cliente", () => {
  const detail: CustomerDetail = {
    ...ana,
    createdAt: "2026-09-01T12:00:00.000Z",
    averageTicketCents: 3250,
    nextAppointmentAt: "2026-12-01T12:00:00.000Z",
    appointments: [
      { id: "a3", status: "NO_SHOW", startAt: "", date: "2026-10-25", time: "09:00", priceCents: 3500, attendeeName: null, service: "Corte", professional: "João" },
      { id: "a2", status: "COMPLETED", startAt: "", date: "2026-10-20", time: "08:00", priceCents: 3000, attendeeName: null, service: "Corte", professional: "João" },
    ],
  };

  it("mostra contato, números, próximo horário e histórico", async () => {
    mockApi({ "GET /auth/me": { status: 200, body: session }, "GET /customers/c1": { status: 200, body: detail } });
    renderApp("/painel/clientes/c1");

    expect(await screen.findByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "(81) 98888-7777" })).toHaveAttribute("href", "tel:81988887777");
    expect(screen.getByRole("link", { name: "ana@example.com" })).toHaveAttribute("href", "mailto:ana@example.com");
    expect(screen.getByText("Ticket médio").closest("div")).toHaveTextContent(/R\$\s32,50/);
    expect(screen.getByText("Próximo horário marcado: 01/12/2026 às 09:00.")).toBeInTheDocument(); // 12:00 UTC = 09:00 em Recife

    const history = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(history[0]).toContain("domingo, 25 de outubro às 09:00");
    expect(history[0]).toContain("Faltou");
    expect(history[1]).toContain("Concluído");
  });

  it("cliente inexistente", async () => {
    mockApi({
      "GET /auth/me": { status: 200, body: session },
      "GET /customers/*": { status: 404, body: { message: "Cliente não encontrado." } },
    });
    renderApp("/painel/clientes/nao-existe");

    expect(await screen.findByText("Cliente não encontrado.")).toBeInTheDocument();
  });
});

describe("agenda -> ficha do cliente", () => {
  it("clicar no nome do cliente na agenda abre a ficha dele", async () => {
    const today = localToday(TZ);
    mockApi({
      "GET /auth/me": { status: 200, body: session },
      "GET /services": { status: 200, body: [{ id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3500, active: true }] },
      "GET /professionals": {
        status: 200,
        body: [{ id: "p1", name: "João", active: true, serviceIds: ["s1"], workingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }] }],
      },
      "GET /time-offs": { status: 200, body: [] },
      "GET /appointments": {
        status: 200,
        body: {
          from: today,
          to: today,
          timezone: TZ,
          appointments: [
            {
              id: "a1",
              status: "SCHEDULED",
              startAt: new Date(Date.now() + 3_600_000).toISOString(),
              endAt: new Date(Date.now() + 5_400_000).toISOString(),
              date: today,
              time: "10:00",
              endTime: "10:30",
              priceCents: 3500,
              customer: { id: "c1", name: "Ana Souza", email: "ana@example.com", phone: "81988887777" },
              service: { id: "s1", name: "Corte" },
              professional: { id: "p1", name: "João" },
            },
          ],
        },
      },
      "GET /customers/c1": {
        status: 200,
        body: { ...ana, createdAt: "2026-09-01T12:00:00.000Z", averageTicketCents: 3250, appointments: [] },
      },
    });
    const user = userEvent.setup();
    renderApp("/painel");

    await user.click(await screen.findByRole("link", { name: "Ana Souza" }));

    expect(await screen.findByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
  });
});
