import { AppError } from "../errors/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { CreateServiceInput, UpdateServiceInput } from "../schemas/services.schemas.js";

// Toda função recebe o establishmentId de quem está logado e filtra por ele.
// É isso que impede um dono de ver ou alterar os serviços de outro.

const serviceSelect = {
  id: true,
  name: true,
  durationMinutes: true,
  priceCents: true,
  active: true,
} satisfies Prisma.ServiceSelect;

export function listServices(establishmentId: string) {
  return prisma.service.findMany({
    where: { establishmentId },
    select: serviceSelect,
    orderBy: { name: "asc" },
  });
}

export function createService(establishmentId: string, input: CreateServiceInput) {
  return prisma.service.create({
    data: { ...input, establishmentId },
    select: serviceSelect,
  });
}

export async function updateService(establishmentId: string, serviceId: string, input: UpdateServiceInput) {
  await findOwnedService(establishmentId, serviceId);

  return prisma.service.update({
    where: { id: serviceId },
    data: input,
    select: serviceSelect,
  });
}

// Serviço de outro estabelecimento responde 404, não 403: não confirmamos nem que ele existe.
async function findOwnedService(establishmentId: string, serviceId: string) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, establishmentId } });
  if (!service) throw new AppError("Serviço não encontrado.", 404);
  return service;
}
