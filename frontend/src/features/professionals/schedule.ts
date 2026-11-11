// Expediente semanal: tipos, validação no front e resumo em texto.
// O backend valida as mesmas regras (src/schemas/professionals.schemas.ts); aqui é para avisar antes de enviar.

export type TimeRange = { startTime: string; endTime: string };
export type WorkingHoursItem = TimeRange & { dayOfWeek: number };
/** Expediente por dia da semana (0 = domingo ... 6 = sábado). */
export type WeekSchedule = Record<number, TimeRange[]>;

/** Ordem de exibição: a semana começa na segunda. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function toWeekSchedule(items: WorkingHoursItem[]): WeekSchedule {
  const week: WeekSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const { dayOfWeek, startTime, endTime } of items) week[dayOfWeek]!.push({ startTime, endTime });
  for (const day of WEEK_ORDER) week[day]!.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return week;
}

export function toWorkingHoursItems(week: WeekSchedule): WorkingHoursItem[] {
  return WEEK_ORDER.flatMap((day) => week[day]!.map((range) => ({ dayOfWeek: day, ...range })));
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Erros por dia (dayOfWeek -> mensagem). Objeto vazio = tudo certo. */
export function validateWeek(week: WeekSchedule): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const day of WEEK_ORDER) {
    const ranges = [...week[day]!].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (ranges.some((r) => !TIME.test(r.startTime) || !TIME.test(r.endTime))) {
      errors[day] = "Preencha início e fim de cada intervalo.";
    } else if (ranges.some((r) => r.startTime >= r.endTime)) {
      errors[day] = "O início precisa ser antes do fim.";
    } else if (ranges.some((r, i) => i > 0 && r.startTime < ranges[i - 1]!.endTime)) {
      errors[day] = "Há intervalos que se sobrepõem.";
    }
  }
  return errors;
}

/** "Seg a Sex: 09:00–12:00, 13:00–19:00 · Sáb: 08:00–14:00" (dias seguidos com o mesmo horário são agrupados) */
export function summarizeWeek(items: WorkingHoursItem[]): string {
  const week = toWeekSchedule(items);
  const label = (day: number) => week[day]!.map((r) => `${r.startTime}–${r.endTime}`).join(", ");

  const groups: { days: number[]; hours: string }[] = [];
  for (const day of WEEK_ORDER) {
    const hours = label(day);
    if (!hours) continue;
    const last = groups.at(-1);
    const previousDay = last?.days.at(-1);
    const consecutive = previousDay !== undefined && WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(previousDay) + 1;
    if (last && last.hours === hours && consecutive) last.days.push(day);
    else groups.push({ days: [day], hours });
  }

  if (groups.length === 0) return "Sem expediente cadastrado";
  return groups
    .map(({ days, hours }) => {
      const first = DAY_SHORT[days[0]!];
      const span = days.length === 1 ? first : `${first} a ${DAY_SHORT[days.at(-1)!]}`;
      return `${span}: ${hours}`;
    })
    .join(" · ");
}
