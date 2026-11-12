import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays, localToday } from "../../lib/format.ts";
import { calls, mockApi, renderApp } from "../../test/mock-api.tsx";

// Login, proteção das rotas e agenda, com a API simulada.

const TZ = "America/Recife";
const today = localToday(TZ);
const HOUR = 60 * 60 * 1000;

const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: TZ },
};

function appointment(id: string, status: string, startAt: Date, customer: string, priceCents = 3500) {
  return {
    id,
    status,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 30 * 60 * 1000).toISOString(),
    date: today,
    time: "10:00",
    endTime: "10:30",
    priceCents,
    customer: { name: customer, email: `${id}@example.com`, phone: "81999999999" },
    service: { id: "s1", name: "Corte" },
    professional: { id: "p1", name: "João" },
  };
}

const passado = appointment("a1", "SCHEDULED", new Date(Date.now() - 2 * HOUR), "Maria Passado");
const futuro = appointment("a2", "SCHEDULED", new Date(Date.now() + 2 * HOUR), "José Futuro");
const concluido = appointment("a3", "COMPLETED", new Date(Date.now() - 4 * HOUR), "Ana Concluída", 5000);

function loggedInRoutes(extra: Parameters<typeof mockApi>[0] = {}) {
  return {
    "GET /auth/me": { status: 200, body: session },
    "GET /professionals": {
      status: 200,
      body: [
        {
          id: "p1",
          name: "João",
          active: true,
          serviceIds: ["s1"],
          workingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }],
        },
      ],
    },
    "GET /services": {
      status: 200,
      body: [{ id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3500, active: true }],
    },
    "GET /time-offs": { status: 200, body: [] },
    "GET /appointments": {
      status: 200,
      body: { from: today, to: today, timezone: TZ, appointments: [concluido, passado, futuro] },
    },
    ...extra,
  };
}

describe("atalhos de endereço", () => {
  it.each([
    ["/login", "Entrar no painel"],
    ["/cadastrar", "Cadastre seu negócio"],
  ])("%s leva para a página certa", async (path, heading) => {
    mockApi({ "GET /auth/me": { status: 401, body: { message: "Não autenticado." } } });
    renderApp(path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });
});

describe("login e proteção do painel", () => {
  it("sem login, quem abre /painel vai para a tela de login", async () => {
    mockApi({ "GET /auth/me": { status: 401, body: { message: "Não autenticado." } } });
    renderApp("/painel");

    expect(await screen.findByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
  });

  it("depois de entrar, mostra a agenda", async () => {
    mockApi({
      ...loggedInRoutes(),
      "GET /auth/me": { status: 401, body: { message: "Não autenticado." } },
      "POST /auth/login": (body) =>
        (body as { password: string }).password === "senha-certa"
          ? { status: 200, body: session }
          : { status: 401, body: { message: "E-mail ou senha inválidos." } },
    });
    const user = userEvent.setup();
    renderApp("/painel");

    await user.type(await screen.findByLabelText("E-mail"), "lucas@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha inválidos.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Senha"));
    await user.type(screen.getByLabelText("Senha"), "senha-certa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByText("Barbearia Teste")).toBeInTheDocument();
  });

  it("se a sessão expirar (401 numa chamada do painel), volta para o login", async () => {
    mockApi(loggedInRoutes({ "GET /appointments": { status: 401, body: { message: "Não autenticado." } } }));
    renderApp("/painel");

    expect(await screen.findByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
  });

  it("sair encerra a sessão", async () => {
    const fetchMock = mockApi(loggedInRoutes({ "POST /auth/logout": { status: 204 } }));
    const user = userEvent.setup();
    renderApp("/painel");

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
    expect(calls(fetchMock)).toContain("POST /auth/logout");
  });
});

describe("primeiros passos", () => {
  it("conta nova sem serviços nem profissionais vê o que falta fazer", async () => {
    mockApi(
      loggedInRoutes({
        "GET /services": { status: 200, body: [] },
        "GET /professionals": { status: 200, body: [] },
        "GET /appointments": { status: 200, body: { from: today, to: today, timezone: TZ, appointments: [] } },
      }),
    );
    renderApp("/painel");

    expect(await screen.findByRole("heading", { name: "Primeiros passos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "serviços" })).toHaveAttribute("href", "/painel/servicos");
  });

  it("some quando já há serviço e profissional com horários", async () => {
    mockApi(loggedInRoutes());
    renderApp("/painel");

    await screen.findByRole("article", { name: /Maria Passado/ });
    expect(screen.queryByRole("heading", { name: "Primeiros passos" })).not.toBeInTheDocument();
  });
});

describe("agenda", () => {
  it("mostra os agendamentos do dia e o resumo", async () => {
    mockApi(loggedInRoutes());
    renderApp("/painel");

    expect(await screen.findByRole("article", { name: /Maria Passado/ })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /José Futuro/ })).toBeInTheDocument();

    const resumo = screen.getByText("Receita (concluídos)").closest("div")!;
    expect(within(resumo).getByText(/R\$\s50,00/)).toBeInTheDocument(); // só o concluído conta
  });

  it("mostra os bloqueios do dia no topo da agenda", async () => {
    const fetchMock = mockApi(
      loggedInRoutes({
        "GET /time-offs": {
          status: 200,
          body: [
            {
              id: "t1",
              professional: null,
              reason: "Feriado",
              startAt: "",
              endAt: "",
              allDay: true,
              startDate: today,
              endDate: today,
              startTime: "00:00",
              endTime: "00:00",
            },
          ],
        },
      }),
    );
    renderApp("/painel");

    expect(await screen.findByText(/Todos os profissionais, dia inteiro \(Feriado\)/)).toBeInTheDocument();
    const url = fetchMock.mock.calls.map(([input]) => String(input)).find((u) => u.includes("/time-offs"));
    expect(url).toContain(`from=${today}&to=${today}`);
  });

  it("consulta o dia de hoje e navega para o próximo", async () => {
    const fetchMock = mockApi(loggedInRoutes());
    const user = userEvent.setup();
    renderApp("/painel");
    await screen.findByRole("heading", { name: "Agenda" });

    await user.click(screen.getByRole("button", { name: "Próximo dia" }));

    const urls = fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes("/appointments?"));
    expect(urls[0]).toContain(`from=${today}&to=${today}`);
    expect(urls.at(-1)).toContain(`from=${addDays(today, 1)}&to=${addDays(today, 1)}`);
  });

  it("marca como concluído um horário que já começou", async () => {
    const fetchMock = mockApi(
      loggedInRoutes({ "PATCH /appointments/*": { status: 200, body: { ...passado, status: "COMPLETED" } } }),
    );
    const user = userEvent.setup();
    renderApp("/painel");

    const card = await screen.findByRole("article", { name: /Maria Passado/ });
    await user.click(within(card).getByRole("button", { name: "Concluído" }));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(String(patch[0])).toBe("/api/appointments/a1/status");
    expect(JSON.parse(patch[1]!.body as string)).toEqual({ status: "COMPLETED" });
  });

  it("cancelar pede confirmação antes de chamar a API", async () => {
    const fetchMock = mockApi(
      loggedInRoutes({ "PATCH /appointments/*": { status: 200, body: { ...futuro, status: "CANCELED" } } }),
    );
    const user = userEvent.setup();
    renderApp("/painel");

    const card = await screen.findByRole("article", { name: /José Futuro/ });
    expect(within(card).queryByRole("button", { name: "Concluído" })).not.toBeInTheDocument(); // ainda não aconteceu

    await user.click(within(card).getByRole("button", { name: "Cancelar" }));
    expect(calls(fetchMock)).not.toContain("PATCH /appointments/a2/status");

    await user.click(within(card).getByRole("button", { name: "Sim, cancelar" }));
    expect(calls(fetchMock)).toContain("PATCH /appointments/a2/status");
  });

  it("mostra o aviso da API quando o agendamento mudou ao mesmo tempo (409)", async () => {
    mockApi(
      loggedInRoutes({
        "PATCH /appointments/*": {
          status: 409,
          body: { message: "Esse agendamento acabou de ser alterado. Atualize a agenda." },
        },
      }),
    );
    const user = userEvent.setup();
    renderApp("/painel");

    const card = await screen.findByRole("article", { name: /Maria Passado/ });
    await user.click(within(card).getByRole("button", { name: "Faltou" }));

    expect(await screen.findByText("Esse agendamento acabou de ser alterado. Atualize a agenda.")).toBeInTheDocument();
  });
});
