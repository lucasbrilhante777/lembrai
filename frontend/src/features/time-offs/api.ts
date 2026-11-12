import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";

// Espelha backend/src/services/time-offs.service.ts
export type TimeOff = {
  id: string;
  professional: { id: string; name: string } | null; // null = estabelecimento inteiro
  reason: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type TimeOffConflict = { id: string; date: string; time: string; customer: string; professional: string };

export type CreateTimeOffInput =
  | { kind: "days"; professionalId: string | null; reason?: string; startDate: string; endDate: string }
  | { kind: "hours"; professionalId: string | null; reason?: string; date: string; startTime: string; endTime: string };

const KEY = ["time-offs"];

/** Sem período: bloqueios atuais e futuros. Com período (agenda): os que encostam nele. */
export function useTimeOffs(range?: { from: string; to: string }) {
  const query = range ? `?${new URLSearchParams(range)}` : "";
  return useQuery({ queryKey: [...KEY, range ?? "upcoming"], queryFn: () => api<TimeOff[]>(`/time-offs${query}`) });
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTimeOffInput) =>
      api<{ timeOff: TimeOff; conflicts: TimeOffConflict[] }>("/time-offs", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/time-offs/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** Bloqueios que valem num dia local (para a agenda). */
export function timeOffsOnDay(timeOffs: TimeOff[], date: string) {
  return timeOffs.filter((t) => t.startDate <= date && date <= t.endDate);
}
