import { describe, expect, it } from "vitest";
import { centsToInput, parsePriceToCents } from "./money.ts";

describe("parsePriceToCents", () => {
  it.each([
    ["35", 3500],
    ["35,5", 3550],
    ["35,50", 3550],
    ["0,99", 99],
    ["R$ 1.234,56", 123456],
    ["0", 0],
  ])("%s -> %i centavos", (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it("não sofre com erro de arredondamento de ponto flutuante", () => {
    // 19,99 * 100 em ponto flutuante dá 1998.9999999999998: por isso o Math.round.
    expect(parsePriceToCents("19,99")).toBe(1999);
  });

  it.each(["", "abc", "35,555", "-10", "10,"])("recusa %j", (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("formata para o campo de edição", () => {
    expect(centsToInput(3500)).toBe("35,00");
    expect(centsToInput(99)).toBe("0,99");
  });
});
