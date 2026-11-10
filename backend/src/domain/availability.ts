import { formatLocalTime, localDateTimeToUtc, minutesToTime, timeToMinutes } from "../utils/zoned-date.js";

// Função pura: não acessa banco nem relógio. Recebe tudo por parâmetro, então
// cada regra pode ser testada isoladamente (inclusive o "agora", via `now`).

/** De quanto em quanto tempo os horários são oferecidos (09:00, 09:15, 09:30...). */
export const SLOT_STEP_MINUTES = 15;

export type WorkingRange = { startTime: string; endTime: string }; // "HH:MM" local
export type BusyInterval = { startAt: Date; endAt: Date }; // UTC

export type Slot = {
  startAt: Date;
  endAt: Date;
  /** Horário local para exibir, ex.: "09:00" */
  time: string;
};

type Params = {
  /** Data local, "YYYY-MM-DD" */
  date: string;
  timezone: string;
  /** Expediente do profissional NESSE dia da semana */
  workingHours: WorkingRange[];
  durationMinutes: number;
  /** Agendamentos ativos do profissional que encostam nesse dia */
  busy: BusyInterval[];
  now: Date;
  stepMinutes?: number;
};

export function computeAvailableSlots({
  date,
  timezone,
  workingHours,
  durationMinutes,
  busy,
  now,
  stepMinutes = SLOT_STEP_MINUTES,
}: Params): Slot[] {
  // Map pela hora UTC: num dia de horário de verão, dois horários locais podem
  // cair no mesmo instante. Assim nenhum horário aparece duplicado.
  const slots = new Map<number, Slot>();

  for (const range of workingHours) {
    const rangeStart = timeToMinutes(range.startTime);
    const rangeEnd = timeToMinutes(range.endTime);

    // O atendimento inteiro precisa caber dentro do expediente.
    for (let minute = rangeStart; minute + durationMinutes <= rangeEnd; minute += stepMinutes) {
      // 1. Converte o horário local para o instante real (UTC), no fuso do estabelecimento.
      const startAt = localDateTimeToUtc(date, minutesToTime(minute), timezone);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

      // 2. Horário que já passou não pode ser agendado.
      if (startAt <= now) continue;

      // 3. Não pode se cruzar com nenhum agendamento existente.
      //    Mesma regra do banco ('[)'): encostar (fim = início) não é conflito.
      const conflicts = busy.some((b) => startAt < b.endAt && endAt > b.startAt);
      if (conflicts) continue;

      slots.set(startAt.getTime(), { startAt, endAt, time: formatLocalTime(startAt, timezone) });
    }
  }

  return [...slots.values()].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
