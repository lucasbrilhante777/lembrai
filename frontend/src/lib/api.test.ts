import { describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api.ts";

function stubFetch(body: string | null, status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status })),
  );
}

describe("api()", () => {
  it("devolve o JSON quando dá certo", async () => {
    stubFetch(JSON.stringify({ ok: true }), 200);
    await expect(api("/qualquer")).resolves.toEqual({ ok: true });
  });

  it("transforma erro da API em ApiError com mensagem e campos", async () => {
    stubFetch(JSON.stringify({ message: "Dados inválidos.", issues: [{ path: "email", message: "E-mail inválido." }] }), 400);

    const error = await api("/qualquer").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "Dados inválidos.", issues: [{ path: "email" }] });
  });

  it("204 (sem corpo) é sucesso", async () => {
    stubFetch(null, 204);
    await expect(api("/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("200 com HTML no lugar de JSON é erro (ex.: proxy fora do ar), não um sucesso silencioso", async () => {
    stubFetch("<!doctype html><html></html>", 200);
    await expect(api("/auth/me")).rejects.toThrow("Resposta inesperada do servidor");
  });
});
