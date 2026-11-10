import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { addDays, formatLongDate, localToday } from "../../lib/format.ts";
import { BookingPage } from "./BookingPage.tsx";

// Testa a página como um cliente usaria: clicando e digitando. A API é simulada trocando o fetch.

const TZ = "America/Recife";
const tomorrow = addDays(localToday(TZ), 1);

const establishment = {
  name: "Barbearia Teste",
  slug: "barbearia-teste",
  timezone: TZ,
  services: [
    { id: "s-corte", name: "Corte", durationMinutes: 30, priceCents: 3500 },
    { id: "s-barba", name: "Barba", durationMinutes: 20, priceCents: 2500 },
  ],
  professionals: [
    { id: "p-joao", name: "João", serviceIds: ["s-corte", "s-barba"] },
    { id: "p-ana", name: "Ana", serviceIds: ["s-barba"] },
  ],
};

const availability = {
  date: tomorrow,
  timezone: TZ,
  slots: [
    { startAt: `${tomorrow}T12:00:00.000Z`, time: "09:00" },
    { startAt: `${tomorrow}T12:30:00.000Z`, time: "09:30" },
  ],
};

const booking = {
  id: "a-1",
  date: tomorrow,
  time: "09:00",
  establishment: { name: "Barbearia Teste" },
  service: { name: "Corte", durationMinutes: 30 },
  professional: { name: "João" },
  priceCents: 3500,
};

type Reply = { status: number; body?: unknown };

/** Simula a API: o GET responde os dados acima e o POST responde o que o teste mandar. */
function mockApi({ post = { status: 201, body: booking }, establishmentStatus = 200 } = {} as {
  post?: Reply;
  establishmentStatus?: number;
}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const reply: Reply =
      init?.method === "POST"
        ? post
        : url.includes("/availability")
          ? { status: 200, body: availability }
          : establishmentStatus === 200
            ? { status: 200, body: establishment }
            : { status: establishmentStatus, body: { message: "Estabelecimento não encontrado." } };
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/agenda/barbearia-teste"]}>
        <Routes>
          <Route path="/agenda/:slug" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Faz os passos 1 a 4: Corte -> João -> amanhã -> horário. */
async function chooseSlot(user: ReturnType<typeof userEvent.setup>, time = "09:00") {
  await user.click(await screen.findByRole("button", { name: /^Corte/ }));
  await user.click(screen.getByRole("button", { name: "João" }));
  await user.click(screen.getByRole("button", { name: formatLongDate(tomorrow) }));
  await user.click(await screen.findByRole("button", { name: time }));
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Seu nome"), "Maria Silva");
  await user.type(screen.getByLabelText("E-mail"), "Maria@Teste.com");
  await user.type(screen.getByLabelText("Telefone (com DDD)"), "(81) 99999-9999");
  await user.click(screen.getByRole("checkbox"));
}

describe("BookingPage", () => {
  it("agenda do começo ao fim e mostra a confirmação", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "Barbearia Teste" })).toBeInTheDocument();
    await chooseSlot(user);
    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByRole("heading", { name: "Agendamento confirmado!" })).toBeInTheDocument();
    expect(screen.getByText("maria@teste.com")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/public/establishments/barbearia-teste/appointments");
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      serviceId: "s-corte",
      professionalId: "p-joao",
      startAt: `${tomorrow}T12:00:00.000Z`,
      customer: { name: "Maria Silva", email: "Maria@Teste.com", phone: "(81) 99999-9999" },
      consent: true,
    });
  });

  it("só mostra os profissionais que fazem o serviço escolhido", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^Corte/ }));

    expect(screen.getByRole("button", { name: "João" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana" })).not.toBeInTheDocument();
  });

  it("se o horário for ocupado (409), avisa, desmarca o horário e guarda os dados digitados", async () => {
    mockApi({ post: { status: 409, body: { message: "Esse horário acabou de ser ocupado. Escolha outro." } } });
    const user = userEvent.setup();
    renderPage();

    await chooseSlot(user);
    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByText("Esse horário acabou de ser ocupado. Escolha outro.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seu nome")).not.toBeInTheDocument(); // formulário some até escolher outro horário

    await user.click(screen.getByRole("button", { name: "09:30" }));

    expect(screen.getByLabelText("Seu nome")).toHaveValue("Maria Silva");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("mostra o erro de validação ao lado do campo", async () => {
    mockApi({
      post: {
        status: 400,
        body: { message: "Dados inválidos.", issues: [{ path: "customer.email", message: "E-mail inválido." }] },
      },
    });
    const user = userEvent.setup();
    renderPage();

    await chooseSlot(user);
    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByText("E-mail inválido.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  it("avisa quando o estabelecimento não existe", async () => {
    mockApi({ establishmentStatus: 404 });
    renderPage();

    expect(await screen.findByText("Não encontramos esse estabelecimento. Confira o link.")).toBeInTheDocument();
  });
});
