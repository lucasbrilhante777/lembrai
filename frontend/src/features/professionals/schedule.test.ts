import { describe, expect, it } from "vitest";
import { summarizeWeek, toWeekSchedule, validateWeek, type WorkingHoursItem } from "./schedule.ts";

const weekday = (day: number): WorkingHoursItem[] => [
  { dayOfWeek: day, startTime: "09:00", endTime: "12:00" },
  { dayOfWeek: day, startTime: "13:00", endTime: "19:00" },
];

describe("summarizeWeek", () => {
  it("agrupa dias seguidos com o mesmo horário", () => {
    const items = [...[1, 2, 3, 4, 5].flatMap(weekday), { dayOfWeek: 6, startTime: "08:00", endTime: "14:00" }];

    expect(summarizeWeek(items)).toBe("Seg a Sex: 09:00–12:00, 13:00–19:00 · Sáb: 08:00–14:00");
  });

  it("não agrupa dias iguais que não são seguidos", () => {
    const items = [...weekday(1), ...weekday(3)];

    expect(summarizeWeek(items)).toBe("Seg: 09:00–12:00, 13:00–19:00 · Qua: 09:00–12:00, 13:00–19:00");
  });

  it("sem expediente", () => {
    expect(summarizeWeek([])).toBe("Sem expediente cadastrado");
  });
});

describe("validateWeek", () => {
  const week = (ranges: { startTime: string; endTime: string }[]) =>
    toWeekSchedule(ranges.map((r) => ({ dayOfWeek: 2, ...r })));

  it("aceita intervalos válidos e sem sobreposição", () => {
    expect(validateWeek(week([{ startTime: "09:00", endTime: "12:00" }, { startTime: "12:00", endTime: "18:00" }]))).toEqual({});
  });

  it.each([
    ["campo vazio", [{ startTime: "09:00", endTime: "" }], "Preencha"],
    ["início depois do fim", [{ startTime: "18:00", endTime: "09:00" }], "antes do fim"],
    [
      "intervalos que se cruzam",
      [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "11:00", endTime: "14:00" },
      ],
      "sobrepõem",
    ],
  ])("aponta erro: %s", (_label, ranges, message) => {
    expect(validateWeek(week(ranges))[2]).toContain(message);
  });
});
