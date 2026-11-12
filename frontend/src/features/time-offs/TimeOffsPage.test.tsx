import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { localToday } from "../../lib/format.ts";
import { mockApi, renderApp } from "../../test/mock-api.tsx";
import type { TimeOff } from "./api.ts";

const TZ = "America/Recife";
const today = localToday(TZ);
const session = {
  user: { id: "u1", name: "Lucas", email: "lucas@example.com" },
  establishment: { id: "e1", name: "Barbearia Teste", slug: "barbearia-teste", timezone: TZ },
};
const joao = { id: "p1", name: "João", active: true, serviceIds: [], workingHours: [] };

const feriado: TimeOff = {
  id: "t1",
  professional: null,
  reason: "Feriado",
  startAt: "",
  endAt: "",
  allDay: true,
  startDate: "2026-12-24",
  endDate: "2026-12-26",
  startTime: "00:00",
  endTime: "00:00",
};

function timeOffsApi(initial: TimeOff[], conflicts: unknown[] = []) {
  let timeOffs = [...initial];
  return mockApi({
    "GET /auth/me": { status: 200, body: session },
    "GET /professionals": { status: 200, body: [joao] },
    "GET /time-offs": () => ({ status: 200, body: timeOffs }),
    "POST /time-offs": (body) => {
      const created = { ...feriado, id: "t-new", reason: (body as { reason?: string }).reason ?? null };
      timeOffs = [...timeOffs, created];
      return { status: 201, body: { timeOff: created, conflicts } };
    },
    "DELETE /time-offs/*": (_body, url) => {
      timeOffs = timeOffs.filter((t) => t.id !== url.pathname.split("/").at(-1));
      return { status: 204 };
    },
  });
}

const postBody = (fetchMock: ReturnType<typeof mockApi>) =>
  JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string);

describe("tela de bloqueios", () => {
  it("lista os bloqueios com período, quem e motivo", async () => {
    timeOffsApi([feriado]);
    renderApp("/painel/bloqueios");

    const item = await screen.findByRole("article", { name: /Todos os profissionais: Dias inteiros: 24\/12 a 26\/12/ });
    expect(within(item).getByText(/Feriado/)).toBeInTheDocument();
  });

  it("bloqueia dias inteiros do estabelecimento todo (feriado)", async () => {
    const fetchMock = timeOffsApi([]);
    const user = userEvent.setup();
    renderApp("/painel/bloqueios");

    await user.type(await screen.findByLabelText("Motivo (opcional)"), "Feriado");
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    expect(await screen.findByText("Bloqueio criado. Não havia agendamentos nesse período.")).toBeInTheDocument();
    expect(postBody(fetchMock)).toEqual({
      kind: "days",
      professionalId: null,
      reason: "Feriado",
      startDate: today,
      endDate: today,
    });
  });

  it("bloqueia algumas horas de um profissional", async () => {
    const fetchMock = timeOffsApi([]);
    const user = userEvent.setup();
    renderApp("/painel/bloqueios");

    await screen.findByRole("option", { name: "João" }); // espera a lista de profissionais chegar da API
    await user.selectOptions(screen.getByLabelText("Quem fica bloqueado"), "p1");
    await user.click(screen.getByRole("radio", { name: "Algumas horas" }));
    await user.clear(screen.getByLabelText("Das"));
    await user.type(screen.getByLabelText("Das"), "14:00");
    await user.clear(screen.getByLabelText("Até"));
    await user.type(screen.getByLabelText("Até"), "16:00");
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    await screen.findByText(/Bloqueio criado/);
    expect(postBody(fetchMock)).toEqual({
      kind: "hours",
      professionalId: "p1",
      date: today,
      startTime: "14:00",
      endTime: "16:00",
    });
  });

  it("avisa sobre agendamentos que já existiam no período (eles não são cancelados)", async () => {
    timeOffsApi([], [{ id: "a1", date: "2026-12-24", time: "09:00", customer: "Maria", professional: "João" }]);
    const user = userEvent.setup();
    renderApp("/painel/bloqueios");

    await user.click(await screen.findByRole("button", { name: "Bloquear" }));

    expect(await screen.findByText(/já existe 1 agendamento nesse período/)).toBeInTheDocument();
    expect(screen.getByText(/quinta-feira, 24 de dezembro às 09:00: Maria \(João\)/)).toBeInTheDocument();
  });

  it("remove um bloqueio", async () => {
    timeOffsApi([feriado]);
    const user = userEvent.setup();
    renderApp("/painel/bloqueios");

    const item = await screen.findByRole("article", { name: /Dias inteiros: 24\/12 a 26\/12/ });
    await user.click(within(item).getByRole("button", { name: "Remover" }));

    expect(await screen.findByText("Nenhum bloqueio.")).toBeInTheDocument();
  });
});
