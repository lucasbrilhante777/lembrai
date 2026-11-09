import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "../src/domain/availability.js";

// Testes unitários: só a lógica do cálculo, sem banco e sem HTTP.

const base = {
  date: "2026-11-10", // terça-feira
  timezone: "America/Recife", // UTC-3, sem horário de verão
  durationMinutes: 30,
  busy: [],
  now: new Date("2026-11-01T00:00:00Z"), // bem antes da data, para não descartar nada
};

const times = (slots: { time: string }[]) => slots.map((s) => s.time);

describe("computeAvailableSlots", () => {
  it("oferece horários de 15 em 15 minutos que cabem inteiros no expediente", () => {
    const slots = computeAvailableSlots({ ...base, workingHours: [{ startTime: "09:00", endTime: "10:00" }] });

    // 09:45 não aparece: um serviço de 30 min terminaria 10:15, depois do fim do expediente.
    expect(times(slots)).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("respeita o intervalo de almoço (dois períodos no mesmo dia)", () => {
    const slots = computeAvailableSlots({
      ...base,
      durationMinutes: 60,
      workingHours: [
        { startTime: "09:00", endTime: "11:00" },
        { startTime: "13:00", endTime: "14:30" },
      ],
    });

    expect(times(slots)).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "13:00", "13:15", "13:30"]);
  });

  it("converte o horário local para UTC usando o fuso do estabelecimento", () => {
    const [first] = computeAvailableSlots({ ...base, workingHours: [{ startTime: "09:00", endTime: "09:30" }] });

    expect(first?.startAt.toISOString()).toBe("2026-11-10T12:00:00.000Z"); // 09:00 em Recife = 12:00 UTC
    expect(first?.endAt.toISOString()).toBe("2026-11-10T12:30:00.000Z");
  });

  it("remove horários que se cruzam com agendamentos existentes, mas aceita os que encostam", () => {
    const slots = computeAvailableSlots({
      ...base,
      workingHours: [{ startTime: "09:00", endTime: "11:00" }],
      // Ocupado das 09:30 às 10:00 (horário local)
      busy: [{ startAt: new Date("2026-11-10T12:30:00Z"), endAt: new Date("2026-11-10T13:00:00Z") }],
    });

    // 09:15 (até 09:45), 09:30 e 09:45 batem no agendamento. 09:00 termina 09:30 e 10:00 começa 10:00: encostam, então ficam.
    expect(times(slots)).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });

  it("não oferece horários que já passaram", () => {
    const slots = computeAvailableSlots({
      ...base,
      workingHours: [{ startTime: "09:00", endTime: "11:00" }],
      now: new Date("2026-11-10T12:20:00Z"), // 09:20 em Recife
    });

    expect(times(slots)[0]).toBe("09:30");
  });

  it("sem expediente no dia, não há horários", () => {
    expect(computeAvailableSlots({ ...base, workingHours: [] })).toEqual([]);
  });

  it("acompanha o fim do horário de verão (America/New_York, 1º de novembro de 2026)", () => {
    const params = { ...base, timezone: "America/New_York", workingHours: [{ startTime: "09:00", endTime: "09:30" }] };
    const now = new Date("2026-10-01T00:00:00Z");

    const [antes] = computeAvailableSlots({ ...params, now, date: "2026-10-31" }); // ainda no horário de verão (UTC-4)
    const [depois] = computeAvailableSlots({ ...params, now, date: "2026-11-01" }); // horário padrão (UTC-5)

    // Mesmo "09:00" local, instantes diferentes em UTC.
    expect(antes?.startAt.toISOString()).toBe("2026-10-31T13:00:00.000Z");
    expect(depois?.startAt.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(depois?.time).toBe("09:00");
  });
});
