import { describe, expect, it } from "vitest";
import {
  type AppointmentStatus,
  type OwnerTargetStatus,
  statusChangeError,
} from "../src/domain/appointment-status.js";

// Testes unitários da máquina de estados, sem banco.

const now = new Date("2026-11-10T12:00:00Z");
const future = new Date("2026-11-10T15:00:00Z");
const past = new Date("2026-11-10T09:00:00Z");

const allowed = (from: AppointmentStatus, to: OwnerTargetStatus, startAt: Date) =>
  statusChangeError(from, to, startAt, now) === null;

describe("statusChangeError", () => {
  it.each([
    ["SCHEDULED", "CANCELED", future, true],
    ["SCHEDULED", "CANCELED", past, false], // horário já começou
    ["SCHEDULED", "COMPLETED", past, true],
    ["SCHEDULED", "COMPLETED", future, false], // ainda não aconteceu
    ["SCHEDULED", "NO_SHOW", past, true],
    ["SCHEDULED", "NO_SHOW", future, false],
    ["COMPLETED", "NO_SHOW", past, true], // corrigir clique errado
    ["NO_SHOW", "COMPLETED", past, true],
    ["COMPLETED", "CANCELED", past, false],
    ["CANCELED", "COMPLETED", past, false], // cancelado é definitivo
    ["CANCELED", "NO_SHOW", past, false],
  ] as const)("%s -> %s (horário %s): permitido = %s", (from, to, startAt, expected) => {
    expect(allowed(from, to, startAt)).toBe(expected);
  });

  it("repetir o mesmo status não é erro", () => {
    expect(allowed("COMPLETED", "COMPLETED", past)).toBe(true);
    expect(allowed("CANCELED", "CANCELED", past)).toBe(true);
  });

  it("explica o motivo quando não pode", () => {
    expect(statusChangeError("SCHEDULED", "NO_SHOW", future, now)).toMatch(/depois que o horário começar/);
  });
});
