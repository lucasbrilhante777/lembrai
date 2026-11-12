import { describe, expect, it } from "vitest";
import { niceMax, percentChange, presetRange } from "./math.ts";

describe("percentChange", () => {
  it("calcula a variação em relação ao anterior", () => {
    expect(percentChange(1200, 1000)).toBeCloseTo(0.2);
    expect(percentChange(800, 1000)).toBeCloseTo(-0.2);
  });

  it("sem base no período anterior, não inventa porcentagem", () => {
    expect(percentChange(500, 0)).toBeNull();
  });
});

describe("niceMax (teto redondo do eixo)", () => {
  it.each([
    [870, 1000],
    [4300, 5000],
    [2100, 2500],
    [12, 20],
    [1000, 1000],
    [0, 1],
  ])("%i -> %i", (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe("presetRange", () => {
  const today = "2026-11-12"; // quinta-feira

  it.each([
    ["week", { from: "2026-11-09", to: "2026-11-15" }], // segunda a domingo
    ["month", { from: "2026-11-01", to: "2026-11-30" }],
    ["lastMonth", { from: "2026-10-01", to: "2026-10-31" }],
    ["last30", { from: "2026-10-14", to: "2026-11-12" }], // 30 dias contando hoje
  ] as const)("%s", (preset, expected) => {
    expect(presetRange(preset, today)).toEqual(expected);
  });

  it("vira o ano: dezembro e janeiro", () => {
    expect(presetRange("month", "2026-12-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(presetRange("lastMonth", "2027-01-10")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});
