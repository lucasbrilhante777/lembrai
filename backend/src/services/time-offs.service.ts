import { AppError } from "../errors/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { CreateTimeOffInput, ListTimeOffsQuery } from "../schemas/time-offs.schemas.js";
import { addDays, formatLocalTime, localDateOf, localDateTimeToUtc } from "../utils/zoned-date.js";

// Bloqueios de agenda (rotas do painel, com login). Tudo filtrado pelo establishmentId do token.

const timeOffInclude = { professional: { select: { id: true, name: true } } } satisfies Prisma.TimeOffInclude;
type TimeOffRow = Prisma.TimeOffGetPayload<{ include: typeof timeOffInclude }>;

export async function listTimeOffs(establishmentId: string, query: ListTimeOffsQuery, now = new Date()) {
  const { timezone } = await getEstablishment(establishmentId);

  // Com período: tudo que encosta nele (usado pela agenda). Sem período: o que ainda não terminou.
  const where: Prisma.TimeOffWhereInput =
    query.from && query.to
      ? {
          startAt: { lt: localDateTimeToUtc(addDays(query.to, 1), "00:00", timezone) },
          endAt: { gt: localDateTimeToUtc(query.from, "00:00", timezone) },
        }
      : { endAt: { gt: now } };

  const rows = await prisma.timeOff.findMany({
    where: { establishmentId, ...where },
    include: timeOffInclude,
    orderBy: { startAt: "asc" },
  });
  return rows.map((row) => toDto(row, timezone));
}

export async function createTimeOff(establishmentId: string, input: CreateTimeOffInput, now = new Date()) {
  const { timezone } = await getEstablishment(establishmentId);

  if (input.professionalId) {
    const professional = await prisma.professional.findFirst({
      where: { id: input.professionalId, establishmentId },
    });
    if (!professional) throw new AppError("Profissional não encontrado.", 404);
  }

  // Datas/horas locais -> instantes UTC (ADR 0002). Dias inteiros vão de 00:00 do 1º dia a 00:00 do dia seguinte ao último.
  const [startAt, endAt] =
    input.kind === "days"
      ? [
          localDateTimeToUtc(input.startDate, "00:00", timezone),
          localDateTimeToUtc(addDays(input.endDate, 1), "00:00", timezone),
        ]
      : [
          localDateTimeToUtc(input.date, input.startTime, timezone),
          localDateTimeToUtc(input.date, input.endTime, timezone),
        ];

  if (endAt <= now) throw new AppError("Esse período já passou.", 400);

  const row = await prisma.timeOff.create({
    data: { establishmentId, professionalId: input.professionalId, startAt, endAt, reason: input.reason },
    include: timeOffInclude,
  });

  // O bloqueio NÃO cancela quem já tinha marcado: devolvemos esses agendamentos para o painel avisar o dono.
  const conflicts = await prisma.appointment.findMany({
    where: {
      establishmentId,
      ...(input.professionalId ? { professionalId: input.professionalId } : {}),
      status: "SCHEDULED",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    include: { customer: { select: { name: true } }, professional: { select: { name: true } } },
    orderBy: { startAt: "asc" },
  });

  return {
    timeOff: toDto(row, timezone),
    conflicts: conflicts.map((a) => ({
      id: a.id,
      date: localDateOf(a.startAt, timezone),
      time: formatLocalTime(a.startAt, timezone),
      customer: a.customer.name,
      professional: a.professional.name,
    })),
  };
}

export async function deleteTimeOff(establishmentId: string, timeOffId: string) {
  // deleteMany com o establishmentId no filtro: de outro estabelecimento, apaga 0 linhas e vira 404.
  const { count } = await prisma.timeOff.deleteMany({ where: { id: timeOffId, establishmentId } });
  if (count === 0) throw new AppError("Bloqueio não encontrado.", 404);
}

/** Bloqueios que valem para um profissional num intervalo: os dele e os do estabelecimento inteiro. */
export function findTimeOffsFor(establishmentId: string, professionalId: string, from: Date, to: Date) {
  return prisma.timeOff.findMany({
    where: {
      establishmentId,
      OR: [{ professionalId }, { professionalId: null }],
      startAt: { lt: to },
      endAt: { gt: from },
    },
    select: { startAt: true, endAt: true },
  });
}

async function getEstablishment(establishmentId: string) {
  return prisma.establishment.findUniqueOrThrow({ where: { id: establishmentId }, select: { timezone: true } });
}

// Para exibir: instantes em UTC + a leitura local ("dias inteiros de X a Y" ou "dia X, das H1 às H2").
function toDto(row: TimeOffRow, timezone: string) {
  const startTime = formatLocalTime(row.startAt, timezone);
  const endTime = formatLocalTime(row.endAt, timezone);
  const allDay = startTime === "00:00" && endTime === "00:00";
  return {
    id: row.id,
    professional: row.professional,
    reason: row.reason,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    allDay,
    startDate: localDateOf(row.startAt, timezone),
    // Dia inteiro termina à 00:00 do dia seguinte; para exibir, o último dia é o anterior.
    endDate: allDay ? addDays(localDateOf(row.endAt, timezone), -1) : localDateOf(row.endAt, timezone),
    startTime,
    endTime,
  };
}
