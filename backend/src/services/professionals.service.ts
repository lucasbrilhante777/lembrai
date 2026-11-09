import { AppError } from "../errors/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type {
  CreateProfessionalInput,
  ReplaceWorkingHoursInput,
  UpdateProfessionalInput,
} from "../schemas/professionals.schemas.js";

// Mesmo princípio de services.service.ts: tudo filtrado pelo establishmentId de quem está logado.

const professionalSelect = {
  id: true,
  name: true,
  active: true,
  services: { select: { serviceId: true } },
  workingHours: {
    select: { dayOfWeek: true, startTime: true, endTime: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  },
} satisfies Prisma.ProfessionalSelect;

// O Prisma deduz o formato exato da linha a partir do select acima.
type ProfessionalRow = Prisma.ProfessionalGetPayload<{ select: typeof professionalSelect }>;

// Formato da API: a tabela de ligação vira uma lista simples de ids.
function toDto({ services, ...professional }: ProfessionalRow) {
  return { ...professional, serviceIds: services.map((s) => s.serviceId) };
}

export async function listProfessionals(establishmentId: string) {
  const rows = await prisma.professional.findMany({
    where: { establishmentId },
    select: professionalSelect,
    orderBy: { name: "asc" },
  });
  return rows.map(toDto);
}

export async function createProfessional(establishmentId: string, input: CreateProfessionalInput) {
  await assertServicesBelongTo(establishmentId, input.serviceIds);

  const row = await prisma.professional.create({
    data: {
      name: input.name,
      establishmentId,
      services: { create: input.serviceIds.map((serviceId) => ({ serviceId })) },
    },
    select: professionalSelect,
  });
  return toDto(row);
}

export async function updateProfessional(
  establishmentId: string,
  professionalId: string,
  input: UpdateProfessionalInput,
) {
  await findOwnedProfessional(establishmentId, professionalId);
  const { serviceIds, ...fields } = input;
  if (serviceIds) await assertServicesBelongTo(establishmentId, serviceIds);

  // Transação: trocar a lista de serviços e atualizar os campos acontece por inteiro ou não acontece.
  const row = await prisma.$transaction(async (tx) => {
    if (serviceIds) {
      await tx.professionalService.deleteMany({ where: { professionalId } });
      await tx.professionalService.createMany({
        data: serviceIds.map((serviceId) => ({ professionalId, serviceId })),
      });
    }

    return tx.professional.update({
      where: { id: professionalId },
      data: fields,
      select: professionalSelect,
    });
  });
  return toDto(row);
}

export async function replaceWorkingHours(
  establishmentId: string,
  professionalId: string,
  input: ReplaceWorkingHoursInput,
) {
  await findOwnedProfessional(establishmentId, professionalId);

  const row = await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { professionalId } });
    await tx.workingHours.createMany({
      data: input.workingHours.map((item) => ({ ...item, professionalId })),
    });

    return tx.professional.findUniqueOrThrow({ where: { id: professionalId }, select: professionalSelect });
  });
  return toDto(row);
}

async function findOwnedProfessional(establishmentId: string, professionalId: string) {
  const professional = await prisma.professional.findFirst({ where: { id: professionalId, establishmentId } });
  if (!professional) throw new AppError("Profissional não encontrado.", 404);
  return professional;
}

// Sem isso, um dono poderia vincular ao profissional dele um serviço de OUTRO estabelecimento,
// só mandando o id certo no body.
async function assertServicesBelongTo(establishmentId: string, serviceIds: string[]) {
  if (serviceIds.length === 0) return;

  const count = await prisma.service.count({ where: { id: { in: serviceIds }, establishmentId } });
  if (count !== serviceIds.length) {
    throw new AppError("Um ou mais serviços não existem neste estabelecimento.", 400);
  }
}
