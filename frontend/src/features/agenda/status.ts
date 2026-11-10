import type { Appointment, AppointmentStatus, OwnerTargetStatus } from "./api.ts";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Marcado",
  COMPLETED: "Concluído",
  NO_SHOW: "Faltou",
  CANCELED: "Cancelado",
};

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-sky-50 text-sky-700 ring-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  NO_SHOW: "bg-amber-50 text-amber-800 ring-amber-200",
  CANCELED: "bg-slate-100 text-slate-500 ring-slate-200",
};

export type StatusAction = { status: OwnerTargetStatus; label: string; confirm?: string };

// Quais botões mostrar. Espelha a máquina de estados do backend (src/domain/appointment-status.ts)
// só para esconder o que não faz sentido; quem decide de verdade é a API (que responde 409 se não puder).
export function availableActions(appointment: Appointment, now: Date): StatusAction[] {
  const hasStarted = new Date(appointment.startAt) <= now;

  switch (appointment.status) {
    case "SCHEDULED":
      return hasStarted
        ? [
            { status: "COMPLETED", label: "Concluído" },
            { status: "NO_SHOW", label: "Faltou" },
          ]
        : [{ status: "CANCELED", label: "Cancelar", confirm: "Cancelar este horário? O cliente será avisado por e-mail." }];
    case "COMPLETED":
      return [{ status: "NO_SHOW", label: "Marcar falta" }];
    case "NO_SHOW":
      return [{ status: "COMPLETED", label: "Marcar concluído" }];
    case "CANCELED":
      return [];
  }
}
