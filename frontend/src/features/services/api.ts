import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";

// Espelha backend/src/services/services.service.ts
export type Service = { id: string; name: string; durationMinutes: number; priceCents: number; active: boolean };
export type ServiceInput = { name: string; durationMinutes: number; priceCents: number };

const KEY = ["services"];

export function useServices() {
  return useQuery({ queryKey: KEY, queryFn: () => api<Service[]>("/services") });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceInput) => api<Service>("/services", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ServiceInput> & { id: string; active?: boolean }) =>
      api<Service>(`/services/${id}`, { method: "PATCH", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
