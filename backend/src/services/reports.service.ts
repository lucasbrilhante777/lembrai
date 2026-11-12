import { prisma } from "../lib/prisma.js";
import type { ReportQuery } from "../schemas/reports.schemas.js";
import { addDays, localDateTimeToUtc } from "../utils/zoned-date.js";

// Relatório de faturamento do painel. Regra de receita: soma dos agendamentos CONCLUÍDOS,
// pelo preço salvo no agendamento (priceCentsAtBooking), não pelo preço atual do serviço.
//
// A agregação acontece NO BANCO (GROUP BY), não em JavaScript: o Postgres soma milhares de linhas
// e devolve só os totais, em vez de a API baixar tudo e somar na memória.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getSummary(establishmentId: string, query: ReportQuery) {
  const { timezone } = await prisma.establishment.findUniqueOrThrow({
    where: { id: establishmentId },
    select: { timezone: true },
  });

  // Período anterior com o mesmo tamanho, logo antes (ex.: novembro -> outubro com 30 dias), para comparar.
  const days = Math.round((Date.parse(query.to) - Date.parse(query.from)) / DAY_MS) + 1;
  const previousTo = addDays(query.from, -1);
  const previousFrom = addDays(previousTo, -(days - 1));

  const range = toUtcRange(query.from, query.to, timezone);
  const where = { establishmentId, startAt: { gte: range.start, lt: range.end } };

  const [byStatus, previousTotals, byService, byProfessional, byDay] = await Promise.all([
    // Quantos de cada status e quanto de receita (só os COMPLETED somam).
    prisma.appointment.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { priceCentsAtBooking: true },
    }),
    totalsFor(establishmentId, previousFrom, previousTo, timezone),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where: { ...where, status: "COMPLETED" },
      _count: { _all: true },
      _sum: { priceCentsAtBooking: true },
    }),
    prisma.appointment.groupBy({
      by: ["professionalId", "status"],
      where: { ...where, status: { in: ["COMPLETED", "NO_SHOW"] } },
      _count: { _all: true },
      _sum: { priceCentsAtBooking: true },
    }),
    revenueByLocalDay(establishmentId, range, timezone),
  ]);

  const count = (status: string) => byStatus.find((g) => g.status === status)?._count._all ?? 0;
  const revenueCents = byStatus.find((g) => g.status === "COMPLETED")?._sum.priceCentsAtBooking ?? 0;
  const completed = count("COMPLETED");
  const noShows = count("NO_SHOW");

  return {
    from: query.from,
    to: query.to,
    timezone,
    totals: {
      revenueCents,
      completed,
      noShows,
      canceled: count("CANCELED"),
      // Ainda "marcados": futuros, ou passados que o dono ainda não marcou como concluído/falta.
      scheduled: count("SCHEDULED"),
      averageTicketCents: completed > 0 ? Math.round(revenueCents / completed) : 0,
      // Taxa de faltas entre os atendimentos que tinham que acontecer (concluídos + faltas).
      noShowRate: completed + noShows > 0 ? noShows / (completed + noShows) : null,
    },
    previous: { from: previousFrom, to: previousTo, ...previousTotals },
    byDay: fillMissingDays(query.from, days, byDay),
    byService: await withNames("service", byService.map((g) => ({
      id: g.serviceId,
      completed: g._count._all,
      revenueCents: g._sum.priceCentsAtBooking ?? 0,
    }))),
    byProfessional: await withNames("professional", groupProfessionals(byProfessional)),
  };
}

function toUtcRange(from: string, to: string, timezone: string) {
  return {
    start: localDateTimeToUtc(from, "00:00", timezone),
    end: localDateTimeToUtc(addDays(to, 1), "00:00", timezone),
  };
}

async function totalsFor(establishmentId: string, from: string, to: string, timezone: string) {
  const range = toUtcRange(from, to, timezone);
  const result = await prisma.appointment.aggregate({
    where: { establishmentId, status: "COMPLETED", startAt: { gte: range.start, lt: range.end } },
    _count: { _all: true },
    _sum: { priceCentsAtBooking: true },
  });
  return { revenueCents: result._sum.priceCentsAtBooking ?? 0, completed: result._count._all };
}

// Receita por DIA LOCAL. O groupBy do Prisma não sabe agrupar por "dia no fuso de Recife",
// então aqui vai SQL puro: AT TIME ZONE converte o instante UTC para a hora local antes de cortar o dia.
// O $queryRaw com template (`${...}`) manda os valores como PARÂMETROS, nunca colados no texto do SQL:
// é isso que impede SQL injection.
async function revenueByLocalDay(establishmentId: string, range: { start: Date; end: Date }, timezone: string) {
  const rows = await prisma.$queryRaw<{ day: string; revenue: bigint; completed: bigint }[]>`
    SELECT to_char("startAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
           COALESCE(SUM("priceCentsAtBooking"), 0) AS revenue,
           COUNT(*) AS completed
    FROM "Appointment"
    WHERE "establishmentId" = ${establishmentId}
      AND status = 'COMPLETED'
      AND "startAt" >= ${range.start}
      AND "startAt" < ${range.end}
    GROUP BY 1
    ORDER BY 1`;
  // SUM/COUNT voltam como bigint do Postgres; os valores aqui cabem com folga num number.
  return rows.map((r) => ({ date: r.day, revenueCents: Number(r.revenue), completed: Number(r.completed) }));
}

/** O gráfico precisa de todos os dias do período, inclusive os sem receita (zero). */
function fillMissingDays(from: string, days: number, rows: { date: string; revenueCents: number; completed: number }[]) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return byDate.get(date) ?? { date, revenueCents: 0, completed: 0 };
  });
}

function groupProfessionals(
  groups: { professionalId: string; status: string; _count: { _all: number }; _sum: { priceCentsAtBooking: number | null } }[],
) {
  const result = new Map<string, { id: string; completed: number; noShows: number; revenueCents: number }>();
  for (const g of groups) {
    const row = result.get(g.professionalId) ?? { id: g.professionalId, completed: 0, noShows: 0, revenueCents: 0 };
    if (g.status === "COMPLETED") {
      row.completed = g._count._all;
      row.revenueCents = g._sum.priceCentsAtBooking ?? 0;
    } else {
      row.noShows = g._count._all;
    }
    result.set(g.professionalId, row);
  }
  return [...result.values()];
}

/** Junta o nome (o groupBy só devolve ids) e ordena da maior receita para a menor. */
async function withNames<T extends { id: string; revenueCents: number }>(kind: "service" | "professional", rows: T[]) {
  const ids = rows.map((r) => r.id);
  const named =
    kind === "service"
      ? await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await prisma.professional.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const names = new Map(named.map((n) => [n.id, n.name]));
  return rows
    .map((r) => ({ ...r, name: names.get(r.id) ?? "?" }))
    .sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name));
}
