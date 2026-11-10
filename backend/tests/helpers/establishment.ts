import type { Express } from "express";
import { addDays, dayOfWeek, localDateTimeToUtc, localToday } from "../../src/utils/zoned-date.js";
import { createLoggedOwner } from "./auth.js";

export const TZ = "America/Recife"; // fuso usado pelo createLoggedOwner

// Uma data sempre no futuro (daqui a 7 dias), para o teste não depender do dia em que roda.
export const date = addDays(localToday(TZ, new Date()), 7);

/** Instante UTC de um horário local em `date`, no formato que a API devolve. */
export function at(time: string) {
  return localDateTimeToUtc(date, time, TZ).toISOString();
}

// Monta um estabelecimento com 1 serviço de 30 min (R$ 35) e 1 profissional que
// trabalha das 09:00 às 11:00 em `date`.
export async function setupEstablishment(app: Express) {
  const owner = await createLoggedOwner(app);
  const { body: service } = await owner.agent
    .post("/services")
    .send({ name: "Corte", durationMinutes: 30, priceCents: 3500 });
  const { body: professional } = await owner.agent
    .post("/professionals")
    .send({ name: "João", serviceIds: [service.id] });
  await owner.agent
    .put(`/professionals/${professional.id}/working-hours`)
    .send({ workingHours: [{ dayOfWeek: dayOfWeek(date), startTime: "09:00", endTime: "11:00" }] });

  return { ...owner, serviceId: service.id as string, professionalId: professional.id as string };
}

export type EstablishmentSetup = Awaited<ReturnType<typeof setupEstablishment>>;
