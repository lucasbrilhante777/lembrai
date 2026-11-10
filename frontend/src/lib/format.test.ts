import { describe, expect, it } from "vitest";
import { addDays, formatDayChip, formatDuration, formatLongDate, formatPrice, localToday } from "./format.ts";

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

  it("formata datas de calendário sem deslocar o dia", () => {
    expect(formatDayChip("2026-11-17")).toEqual({ weekday: "ter.", day: "17/11" });
    expect(formatLongDate("2026-11-17")).toBe("terça-feira, 17 de novembro");
  });
});
