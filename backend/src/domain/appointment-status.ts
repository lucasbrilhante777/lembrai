// Regras de quem pode virar o quê. Função pura (sem banco, sem relógio), testada isoladamente.
//
//                ┌──────────► CANCELED   (só antes do horário; definitivo)
//   SCHEDULED ───┤
//                └──────────► COMPLETED ◄──► NO_SHOW   (só depois que o horário começou)
//
// - CANCELED é definitivo: o horário pode já ter sido pego por outra pessoa, então "descancelar" causaria conflito.
// - COMPLETED e NO_SHOW podem ser trocados entre si: o dono pode ter clicado errado.

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type OwnerTargetStatus = Exclude<AppointmentStatus, "SCHEDULED">;

/** Retorna null se a mudança é permitida, ou a mensagem explicando por que não é. */
export function statusChangeError(
  from: AppointmentStatus,
  to: OwnerTargetStatus,
  startAt: Date,
  now: Date,
): string | null {
  if (from === to) return null; // mesma situação: nada a fazer, não é erro

  const hasStarted = startAt <= now;

  if (from === "CANCELED") return "Agendamento cancelado não pode ser alterado.";

  if (to === "CANCELED") {
    if (from !== "SCHEDULED") return "Só é possível cancelar um agendamento que ainda está marcado.";
    if (hasStarted) return "Não é possível cancelar um horário que já começou.";
    return null;
  }

  // to === COMPLETED ou NO_SHOW
  if (!hasStarted) return "Só é possível marcar como concluído ou falta depois que o horário começar.";
  return null;
}
