import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayChip,
  formatDuration,
  formatLongDate,
  formatPrice,
  formatWeekRange,
  localToday,
  startOfWeek,
} from "./format.ts";

describe("format", () => {
  it("formata preço em reais", () => {
    // \s: o Intl usa espaço não separável entre "R$" e o valor.
    expect(formatPrice(3500)).toMatch(/^R\$\s35,00$/);
  });

  it.each([
    [30, "30 min"],
    [60, "1h"],
    [80, "1h 20min"],
  ])("formata duração de %i minutos como %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it("soma dias atravessando o mês", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("usa a data de hoje no fuso do estabelecimento, não no do navegador", () => {
    // 02:00 UTC do dia 11 ainda é dia 10 em Recife (UTC-3).
    expect(localToday("America/Recife", new Date("2026-11-11T02:00:00Z"))).toBe("2026-11-10");
  });

  it("a semana começa na segunda-feira", () => {
    expect(startOfWeek("2026-11-11")).toBe("2026-11-09"); // quarta -> segunda
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09"); // segunda -> ela mesma
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // domingo -> segunda anterior
  });

  it("formata o período da semana, inclusive atravessando o mês", () => {
    expect(formatWeekRange("2026-11-09", "2026-11-15")).toMatch(/^9\s–\s15 de novembro$/);
    expect(formatWeekRange("2026-11-30", "2026-12-06")).toMatch(/^30 de novembro\s–\s6 de dezembro$/);
  });

  it("formata datas de calendário sem deslocar o dia", () => {
    expect(formatDayChip("2026-11-17")).toEqual({ weekday: "ter.", day: "17/11" });
    expect(formatLongDate("2026-11-17")).toBe("terça-feira, 17 de novembro");
  });
});
