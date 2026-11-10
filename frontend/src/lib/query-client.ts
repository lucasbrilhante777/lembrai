import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api.ts";
import { SESSION_KEY } from "../features/auth/api.ts";

// Se qualquer chamada do painel responder 401 (sessão expirou), marcamos a sessão como encerrada.
// A rota protegida percebe e manda o usuário para o login, em vez de mostrar telas quebradas.
export function handleQueryError(queryClient: QueryClient, error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(SESSION_KEY, null);
  }
}

export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleQueryError(queryClient, error) }),
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
  });
  return queryClient;
}
