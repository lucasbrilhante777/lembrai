import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.ts";

// Tipos espelham backend/src/services/appointments.service.ts (função toDto).

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type OwnerTargetStatus = Exclude<AppointmentStatus, "SCHEDULED">;

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  date: string;
  time: string;
  endTime: string;
  priceCents: number;
  customer: { name: string; email: string; phone: string };
  service: { id: string; name: string };
  professional: { id: string; name: string };
};

export type AgendaResponse = { from: string; to: string; timezone: string; appointments: Appointment[] };

export type ProfessionalOption = { id: string; name: string; active: boolean };

export function useAppointments(params: { from: string; to: string; professionalId: string | null }) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.professionalId) query.set("professionalId", params.professionalId);
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => api<AgendaResponse>(`/appointments?${query}`),
  });
}

export function useProfessionalOptions() {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: () => api<ProfessionalOption[]>("/professionals"),
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OwnerTargetStatus }) =>
      api<Appointment>(`/appointments/${id}/status`, { method: "PATCH", body: { status } }),
    // Deu certo ou deu conflito (409): recarrega a agenda para mostrar o estado real.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });
}
