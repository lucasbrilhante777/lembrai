import { randomBytes } from "node:crypto";
import { prisma } from "../../src/lib/prisma.js";
import type { EstablishmentSetup } from "./establishment.js";

// Cria um agendamento direto no banco, para testes que precisam controlar datas
// (ex.: createdAt de dias atrás) sem passar pelas regras da rota pública.
export async function insertAppointment(
  setup: EstablishmentSetup,
  {
    startAt,
    createdAt = new Date(),
    status = "SCHEDULED",
    email = "maria@teste.com",
  }: { startAt: Date; createdAt?: Date; status?: "SCHEDULED" | "CANCELED" | "COMPLETED"; email?: string },
) {
  const customer = await prisma.customer.upsert({
    where: { establishmentId_email: { establishmentId: setup.establishmentId, email } },
    create: { name: "Maria Silva", email, phone: "81999999999", establishmentId: setup.establishmentId },
    update: {},
  });

  return prisma.appointment.create({
    data: {
      establishmentId: setup.establishmentId,
      professionalId: setup.professionalId,
      serviceId: setup.serviceId,
      customerId: customer.id,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      priceCentsAtBooking: 3500,
      status,
      cancelToken: randomBytes(32).toString("base64url"),
      createdAt,
    },
  });
}
