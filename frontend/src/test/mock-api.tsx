import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { App } from "../App.tsx";
import { handleQueryError } from "../lib/query-client.ts";

// API falsa para os testes: cada rota responde o que o teste definir.
// Ex.: mockApi({ "GET /auth/me": { status: 401 }, "POST /auth/login": { status: 200, body: {...} } })

type Reply = { status: number; body?: unknown };
type Handler = Reply | ((body: unknown, url: URL) => Reply);

// Rotas chamadas pela tela que o teste não simulou. O setup.ts reprova o teste se sobrar alguma:
// sem isso, o erro ficaria "engolido" pelo React Query e o teste passaria sem testar de verdade.
let unmatchedRoutes: string[] = [];

export function takeUnmatchedRoutes() {
  const found = unmatchedRoutes;
  unmatchedRoutes = [];
  return found;
}

export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api/, "");

    // Procura "MÉTODO /caminho" exato; se não achar, uma rota terminada em "*" que case com o começo.
    const key =
      `${method} ${path}` in routes
        ? `${method} ${path}`
        : Object.keys(routes).find((k) => k.endsWith("*") && `${method} ${path}`.startsWith(k.slice(0, -1)));
    if (!key) {
      unmatchedRoutes.push(`${method} ${path}`);
      throw new Error(`Rota não simulada no teste: ${method} ${path}`);
    }

    const handler = routes[key]!;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const reply = typeof handler === "function" ? handler(body, url) : handler;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Renderiza o app inteiro (com todas as rotas) começando na URL informada. */
export function renderApp(path: string) {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleQueryError(queryClient, error) }),
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Chamadas feitas ao fetch simulado, no formato "MÉTODO /caminho". */
export function calls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.map(([input, init]) => {
    const url = new URL(input, "http://localhost");
    return `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api/, "")}`;
  });
}
