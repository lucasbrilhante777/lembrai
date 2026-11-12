import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { localToday } from "../../lib/format.ts";
import { mockApi, renderApp } from "../../test/mock-api.tsx";
import type { ReportSummary } from "./api.ts";
import { presetRange } from "./math.ts";

const TZ = "America/Recife";
const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: TZ },
};

const report: ReportSummary = {
  from: "2026-11-01",
  to: "2026-11-03",
  timezone: TZ,
  totals: { revenueCents: 12000, completed: 4, noShows: 1, canceled: 2, scheduled: 3, averageTicketCents: 3000, noShowRate: 0.2 },
  previous: { from: "2026-10-29", to: "2026-10-31", revenueCents: 10000, completed: 5 },
  byDay: [
    { date: "2026-11-01", revenueCents: 7000, completed: 2 },
    { date: "2026-11-02", revenueCents: 0, completed: 0 },
    { date: "2026-11-03", revenueCents: 5000, completed: 2 },
  ],
  byService: [
    { id: "s1", name: "Corte", completed: 3, revenueCents: 9500 },
    { id: "s2", name: "Barba", completed: 1, revenueCents: 2500 },
  ],
  byProfessional: [{ id: "p1", name: "João", completed: 4, noShows: 1, revenueCents: 12000 }],
};

function reportApi(body: ReportSummary = report) {
  return mockApi({
    "GET /auth/me": { status: 200, body: session },
    "GET /reports/summary": { status: 200, body },
  });
}

const tile = (label: string) => screen.getByText(label).closest("div")!;

describe("tela de relatórios", () => {
  it("mostra receita, atendimentos, ticket médio e taxa de faltas, com a variação vs o período anterior", async () => {
    reportApi();
    renderApp("/painel/relatorios");

    await screen.findByText("Receita");
    expect(within(tile("Receita")).getByText(/R\$\s120,00/)).toBeInTheDocument();
    expect(within(tile("Receita")).getByText(/▲ \+20%/)).toBeInTheDocument(); // 120 vs 100
    expect(within(tile("Atendimentos concluídos")).getByText(/▼ -20%/)).toBeInTheDocument(); // 4 vs 5
    expect(within(tile("Ticket médio")).getByText(/R\$\s30,00/)).toBeInTheDocument();
    expect(within(tile("Taxa de faltas")).getByText("20%")).toBeInTheDocument();
    expect(screen.getByText(/3 agendamento\(s\) do período ainda sem resultado/)).toBeInTheDocument();
  });

  it("abre no mês atual e troca o período pelos atalhos", async () => {
    const fetchMock = reportApi();
    const user = userEvent.setup();
    renderApp("/painel/relatorios");
    await screen.findByText("Receita");

    await user.click(screen.getByRole("button", { name: "Mês passado" }));

    const today = localToday(TZ);
    const urls = fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/reports/summary"));
    const month = presetRange("month", today);
    const lastMonth = presetRange("lastMonth", today);
    expect(urls[0]).toContain(`from=${month.from}&to=${month.to}`);
    expect(urls.at(-1)).toContain(`from=${lastMonth.from}&to=${lastMonth.to}`);
  });

  it("rankings por serviço e por profissional, do maior para o menor", async () => {
    reportApi();
    renderApp("/painel/relatorios");

    const services = await screen.findAllByRole("listitem", { name: /: R\$/ });
    expect(services.map((li) => li.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Corte: R\$\s95,00$/),
      expect.stringMatching(/^Barba: R\$\s25,00$/),
      expect.stringMatching(/^João: R\$\s120,00$/),
    ]);
  });

  it("o gráfico tem uma visão em tabela com os mesmos números", async () => {
    reportApi();
    const user = userEvent.setup();
    renderApp("/painel/relatorios");

    expect(await screen.findByRole("figure", { name: "Gráfico de receita por dia" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver tabela" }));

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4); // cabeçalho + 3 dias (inclusive o dia sem receita)
    expect(within(rows[1]!).getByText(/R\$\s70,00/)).toBeInTheDocument();
  });

  it("dica do gráfico ao focar uma barra pelo teclado", async () => {
    reportApi();
    const user = userEvent.setup();
    renderApp("/painel/relatorios");
    await screen.findByRole("figure", { name: "Gráfico de receita por dia" });

    await user.tab(); // primeiro elemento focável da página
    while (!document.activeElement?.getAttribute("aria-label")?.startsWith("01/11")) await user.tab();

    expect(screen.getByRole("tooltip")).toHaveTextContent(/01\/11R\$\s70,002 atendimento\(s\)/);
  });

  it("período sem receita mostra uma mensagem em vez de um gráfico vazio", async () => {
    reportApi({
      ...report,
      totals: { ...report.totals, revenueCents: 0, completed: 0, averageTicketCents: 0, noShowRate: null },
      previous: { ...report.previous, revenueCents: 0, completed: 0 },
      byDay: report.byDay.map((d) => ({ ...d, revenueCents: 0, completed: 0 })),
      byService: [],
      byProfessional: [],
    });
    renderApp("/painel/relatorios");

    expect(await screen.findByText("Nenhuma receita neste período.")).toBeInTheDocument();
    expect(within(tile("Receita")).getByText("Sem dados no período anterior")).toBeInTheDocument();
    expect(within(tile("Taxa de faltas")).getByText("–")).toBeInTheDocument();
  });
});
