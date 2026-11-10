import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";
import type { WorkingHoursItem } from "./schedule.ts";

// Espelha backend/src/services/professionals.service.ts (função toDto)
export type Professional = {
  id: string;
  name: string;
  active: boolean;
  serviceIds: string[];
  workingHours: WorkingHoursItem[];
};

// A agenda também usa esta lista (filtro por profissional), com a mesma chave de cache.
export const PROFESSIONALS_KEY = ["professionals"];

export function useProfessionals() {
  return useQuery({ queryKey: PROFESSIONALS_KEY, queryFn: () => api<Professional[]>("/professionals") });
}

function useInvalidateProfessionals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROFESSIONALS_KEY });
}

export function useCreateProfessional() {
  const invalidate = useInvalidateProfessionals();
  return useMutation({
    mutationFn: (body: { name: string; serviceIds: string[] }) =>
      api<Professional>("/professionals", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdateProfessional() {
  const invalidate = useInvalidateProfessionals();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; active?: boolean; serviceIds?: string[] }) =>
      api<Professional>(`/professionals/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useReplaceWorkingHours() {
  const invalidate = useInvalidateProfessionals();
  return useMutation({
    mutationFn: ({ id, workingHours }: { id: string; workingHours: WorkingHoursItem[] }) =>
      api<Professional>(`/professionals/${id}/working-hours`, { method: "PUT", body: { workingHours } }),
    onSuccess: invalidate,
  });
}
