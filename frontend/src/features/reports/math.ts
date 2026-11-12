import { addDays, startOfWeek } from "../../lib/format.ts";

/** Variação percentual em relação ao anterior. null quando não há base para comparar (anterior = 0). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * Teto "redondo" para o eixo do gráfico: 870 -> 1000, 4300 -> 5000, 12 -> 20.
 * Assim as marcas do eixo ficam em números limpos (0, 250, 500...) em vez de 0, 217, 435.
 */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

export type PeriodPreset = "week" | "month" | "lastMonth" | "last30";

/** Período (datas locais, inclusivas) de cada atalho, a partir de "hoje" no fuso do estabelecimento. */
export function presetRange(preset: PeriodPreset, today: string): { from: string; to: string } {
  const [year, month] = today.split("-").map(Number) as [number, number];
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  switch (preset) {
    case "week": {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: firstOfMonth, to: addDays(firstOfNextMonth(year, month), -1) };
    case "lastMonth": {
      const to = addDays(firstOfMonth, -1);
      return { from: `${to.slice(0, 7)}-01`, to };
    }
    case "last30":
      return { from: addDays(today, -29), to: today };
  }
}

function firstOfNextMonth(year: number, month: number) {
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}
