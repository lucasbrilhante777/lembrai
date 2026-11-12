import { formatLongDate, formatShortDate as shortDate } from "../../lib/format.ts";
import type { TimeOff } from "./api.ts";

/** "Dias inteiros: 20/12 a 30/12" | "Dia inteiro: terça-feira, 17 de novembro" | "terça-feira, 17 de novembro, 14:00–16:00" */
export function describePeriod(timeOff: TimeOff) {
  if (!timeOff.allDay) return `${formatLongDate(timeOff.startDate)}, ${timeOff.startTime}–${timeOff.endTime}`;
  if (timeOff.startDate === timeOff.endDate) return `Dia inteiro: ${formatLongDate(timeOff.startDate)}`;
  return `Dias inteiros: ${shortDate(timeOff.startDate)} a ${shortDate(timeOff.endDate)}`;
}

/** "Todos os profissionais" ou o nome de quem está bloqueado. */
export function describeWho(timeOff: TimeOff) {
  return timeOff.professional?.name ?? "Todos os profissionais";
}
