// Formatação para exibir na tela. Datas "AAAA-MM-DD" são datas de calendário do estabelecimento
// (ver ADR 0002): são formatadas como UTC ao meio-dia para o fuso do navegador não mudar o dia.

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** 30 -> "30 min", 60 -> "1h", 80 -> "1h 20min" */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/** Data de hoje no fuso informado, ex.: "2026-11-10". */
export function localToday(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

/** "2026-11-30" + 1 = "2026-12-01" */
export function addDays(date: string, days: number) {
  const d = calendarDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** { weekday: "ter.", day: "17/11" } para os botões de data. */
export function formatDayChip(date: string) {
  const d = calendarDate(date);
  return {
    weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d),
  };
}

/** "terça-feira, 17 de novembro" */
export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(calendarDate(date));
}

function calendarDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}
