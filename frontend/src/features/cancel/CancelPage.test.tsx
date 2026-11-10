import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { calls, mockApi, renderApp } from "../../test/mock-api.tsx";

const summary = {
  status: "SCHEDULED",
  startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  date: "2026-11-17",
  time: "09:00",
  establishment: { name: "Barbearia Teste", slug: "barbearia-teste" },
  service: { name: "Corte" },
  professional: { name: "João" },
};

describe("página de cancelamento (link do e-mail)", () => {
  it("abrir a página não cancela: só o clique no botão cancela", async () => {
    const fetchMock = mockApi({
      "GET /public/appointments/tok123": { status: 200, body: summary },
      "POST /public/appointments/tok123/cancel": { status: 200, body: { ...summary, status: "CANCELED" } },
    });
    const user = userEvent.setup();
    renderApp("/cancelar/tok123");

    expect(await screen.findByText("terça-feira, 17 de novembro às 09:00")).toBeInTheDocument();
    expect(calls(fetchMock)).not.toContain("POST /public/appointments/tok123/cancel");

    await user.click(screen.getByRole("button", { name: "Cancelar agendamento" }));

    expect(await screen.findByRole("heading", { name: "Agendamento cancelado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marcar outro horário" })).toHaveAttribute("href", "/agenda/barbearia-teste");
  });

  it("agendamento já concluído não mostra o botão", async () => {
    mockApi({ "GET /public/appointments/tok123": { status: 200, body: { ...summary, status: "COMPLETED" } } });
    renderApp("/cancelar/tok123");

    expect(await screen.findByText("Este agendamento não pode mais ser cancelado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).not.toBeInTheDocument();
  });

  it("link inválido mostra uma mensagem amigável", async () => {
    mockApi({ "GET /public/appointments/*": { status: 404, body: { message: "Agendamento não encontrado." } } });
    renderApp("/cancelar/token-errado");

    expect(await screen.findByText(/Não encontramos esse agendamento/)).toBeInTheDocument();
  });
});
