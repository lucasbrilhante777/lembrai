import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router";
import { ApiError, api } from "../../lib/api.ts";

// Tipos espelham backend/src/services/auth.service.ts (função toSession).
export type Session = {
  user: { id: string; name: string; email: string };
  establishment: { id: string; name: string; slug: string; timezone: string };
};

export const SESSION_KEY = ["session"] as const;

/** Quem está logado. `null` = ninguém (401 aqui não é erro, é só "não logado"). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await api<Session>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: Infinity, // a sessão só muda com login/logout (ou um 401, ver lib/query-client.ts)
  });
}

/** Sessão do dono logado, entregue pelo <RequireAuth>. Só funciona dentro das rotas protegidas. */
export function useAuthenticatedSession() {
  return useOutletContext<Session>();
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<Session>("/auth/login", { method: "POST", body }),
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  establishmentName: string;
  timezone: string;
};

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) => api<Session>("/auth/register", { method: "POST", body }),
    onSuccess: (session) => queryClient.setQueryData(SESSION_KEY, session),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    // Marca "ninguém logado" e apaga o resto do cache: os dados do painel eram de quem saiu.
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    },
  });
}
