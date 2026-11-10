// Cliente HTTP único do front. Toda chamada passa por aqui, então o tratamento de erro é igual em todo lugar.

export type FieldIssue = { path: string; message: string };

/** Erro devolvido pela API, já com a mensagem pronta para mostrar ao usuário. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: FieldIssue[];

  constructor(message: string, status: number, issues: FieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      credentials: "include", // envia o cookie de login
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Não foi possível conectar. Verifique sua internet e tente novamente.", 0);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(data?.message ?? "Algo deu errado. Tente novamente.", response.status, data?.issues ?? []);
  }
  // 200 sem JSON = não foi a nossa API que respondeu (ex.: proxy fora do ar devolvendo o HTML do site).
  // Melhor falhar alto do que seguir com `undefined` fingindo que deu certo.
  if (data === undefined) throw new ApiError("Resposta inesperada do servidor. Tente novamente.", response.status);
  return data as T;
}
