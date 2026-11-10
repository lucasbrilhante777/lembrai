import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// Funções para trabalhar com "datas locais" (YYYY-MM-DD) no fuso do estabelecimento.
// Ver docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md

/** Data de hoje no fuso informado, ex.: "2026-11-10". */
export function localToday(timezone: string, now: Date) {
  return localDateOf(now, timezone);
}

/** Data local de um instante, ex.: 2026-11-11T01:00Z em America/Recife = "2026-11-10". */
export function localDateOf(instant: Date, timezone: string) {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

/** "2026-11-30" + 1 = "2026-12-01". Data de calendário, sem fuso envolvido. */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado. O dia da semana depende só da data de calendário. */
export function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Instante (UTC) de um horário local. Ex.: "2026-11-10" 09:00 em America/Recife = 12:00Z. */
export function localDateTimeToUtc(date: string, time: string, timezone: string) {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

/** Horário local "HH:MM" de um instante. */
export function formatLocalTime(instant: Date, timezone: string) {
  return formatInTimeZone(instant, timezone, "HH:mm");
}

export function timeToMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
