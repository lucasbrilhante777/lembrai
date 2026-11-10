import { describe, expect, it } from "vitest";
import type { Appointment, AppointmentStatus } from "./api.ts";
import { availableActions } from "./status.ts";

const now = new Date("2026-11-10T12:00:00Z");

function appointment(status: AppointmentStatus, startAt: string): Appointment {
  return {
    id: "a",
    status,
    startAt,
    endAt: startAt,
    date: "2026-11-10",
    time: "09:00",
    endTime: "09:30",
    priceCents: 3500,
    customer: { name: "Maria", email: "maria@example.com", phone: "81999999999" },
    service: { id: "s", name: "Corte" },
    professional: { id: "p", name: "João" },
  };
}

const labels = (status: AppointmentStatus, startAt: string) =>
  availableActions(appointment(status, startAt), now).map((a) => a.label);

describe("availableActions (espelha a máquina de estados do backend)", () => {
  it("horário futuro marcado: só pode cancelar, e pede confirmação", () => {
    const actions = availableActions(appointment("SCHEDULED", "2026-11-10T15:00:00Z"), now);
    expect(actions.map((a) => a.label)).toEqual(["Cancelar"]);
    expect(actions[0]?.confirm).toBeDefined();
  });

  it("horário que já começou: concluído ou falta", () => {
    expect(labels("SCHEDULED", "2026-11-10T11:00:00Z")).toEqual(["Concluído", "Faltou"]);
  });

  it("concluído e falta podem ser corrigidos entre si", () => {
    expect(labels("COMPLETED", "2026-11-10T11:00:00Z")).toEqual(["Marcar falta"]);
    expect(labels("NO_SHOW", "2026-11-10T11:00:00Z")).toEqual(["Marcar concluído"]);
  });

  it("cancelado não tem ações", () => {
    expect(labels("CANCELED", "2026-11-10T15:00:00Z")).toEqual([]);
  });
});
