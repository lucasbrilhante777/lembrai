import { AppError } from "../errors/app-error.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { CUSTOMERS_PAGE_SIZE, type ListCustomersQuery } from "../schemas/customers.schemas.js";
import { formatLocalTime, localDateOf } from "../utils/zoned-date.js";

// Clientes do estabelecimento (painel, com login). Tudo filtrado pelo establishmentId do token.

export async function listCustomers(establishmentId: string, query: ListCustomersQuery, now = new Date()) {
  const where: Prisma.CustomerWhereInput = { establishmentId, ...searchFilter(query.search) };

  // Paginação por OFFSET: simples e permite "ir para a página 5". O preço é que, com muitas páginas,
  // o banco ainda precisa contar as linhas puladas. Para listas enormes, a alternativa é paginar por CURSOR.
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }], // id desempata nomes iguais: a ordem nunca muda entre páginas
      skip: (query.page - 1) * CUSTOMERS_PAGE_SIZE,
      take: CUSTOMERS_PAGE_SIZE,
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  const stats = await statsFor(customers.map((c) => c.id), now);

  return {
    items: customers.map((c) => ({ ...c, ...(stats.get(c.id) ?? emptyStats()) })),
    page: query.page,
    pageSize: CUSTOMERS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE)),
  };
}

export async function getCustomer(establishmentId: string, customerId: string, now = new Date()) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, establishmentId },
    include: {
      establishment: { select: { timezone: true } },
      appointments: {
        include: { service: { select: { name: true } }, professional: { select: { name: true } } },
        orderBy: { startAt: "desc" }, // mais recente primeiro
      },
    },
  });
  if (!customer) throw new AppError("Cliente não encontrado.", 404);

  const { timezone } = customer.establishment;
  const stats = (await statsFor([customer.id], now)).get(customer.id) ?? emptyStats();

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt.toISOString(),
    ...stats,
    averageTicketCents: stats.completed > 0 ? Math.round(stats.totalSpentCents / stats.completed) : 0,
    appointments: customer.appointments.map((a) => ({
      id: a.id,
      status: a.status,
      startAt: a.startAt.toISOString(),
      date: localDateOf(a.startAt, timezone),
      time: formatLocalTime(a.startAt, timezone),
      priceCents: a.priceCentsAtBooking,
      service: a.service.name,
      professional: a.professional.name,
    })),
  };
}

// Busca sem diferenciar maiúsculas/minúsculas no nome e no e-mail; no telefone, só pelos dígitos
// (o telefone é guardado só com números). Cuidado: se a busca não tiver dígitos, o filtro de telefone
// NÃO pode entrar, porque `contains: ""` casaria com TODOS os clientes.
function searchFilter(search: string): Prisma.CustomerWhereInput {
  if (!search) return {};
  const digits = search.replace(/\D/g, "");
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

/**
 * Números de vários clientes de uma vez, sem N+1: duas consultas agrupadas por cliente para a página
 * inteira, em vez de uma consulta por cliente.
 */
async function statsFor(customerIds: string[], now: Date) {
  const [byStatus, nextAppointments] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["customerId", "status"],
      where: { customerId: { in: customerIds } },
      _count: { _all: true },
      _sum: { priceCentsAtBooking: true },
      _max: { startAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, status: "SCHEDULED", startAt: { gt: now } },
      _min: { startAt: true },
    }),
  ]);

  const stats = new Map(customerIds.map((id) => [id, emptyStats()]));
  // Pega (ou cria) os números do cliente: evita o "!" de "confia que existe".
  const of = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = emptyStats();
      stats.set(id, s);
    }
    return s;
  };

  for (const g of byStatus) {
    const s = of(g.customerId);
    if (g.status === "COMPLETED") {
      s.completed = g._count._all;
      s.totalSpentCents = g._sum.priceCentsAtBooking ?? 0;
      s.lastVisitAt = g._max.startAt?.toISOString() ?? null;
    } else if (g.status === "NO_SHOW") s.noShows = g._count._all;
    else if (g.status === "CANCELED") s.canceled = g._count._all;
  }
  for (const g of nextAppointments) {
    of(g.customerId).nextAppointmentAt = g._min.startAt?.toISOString() ?? null;
  }
  return stats;
}

function emptyStats() {
  return {
    completed: 0,
    noShows: 0,
    canceled: 0,
    totalSpentCents: 0,
    lastVisitAt: null as string | null,
    nextAppointmentAt: null as string | null,
  };
}
