import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { AppointmentStatus, PrismaClient } from "../generated/prisma/client.js";
import { addDays, dayOfWeek, localDateTimeToUtc, localToday, minutesToTime, timeToMinutes } from "../utils/zoned-date.js";

// Conta demo: uma barbearia com serviços, profissionais, expediente e agendamentos espalhados
// por 2 semanas para trás e 2 para frente. É o que um recrutador vê ao entrar no sistema.
//
// - Pode rodar quantas vezes quiser: apaga a conta demo antiga e recria (nada além dela é tocado).
// - Usa um gerador "aleatório" com semente fixa: com o mesmo "agora", gera sempre os mesmos dados.
// - Clientes usam @example.com, domínio reservado (RFC 2606): nenhum e-mail chega a uma pessoa real.

export const DEMO = {
  ownerName: "Dono Demo",
  email: "demo@example.com",
  password: "lembrai-demo",
  establishmentName: "Barbearia Demo",
  slug: "barbearia-demo",
  timezone: "America/Recife",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_BACK = 14;
const DAYS_AHEAD = 14;

const SERVICES = [
  { key: "corte", name: "Corte", durationMinutes: 30, priceCents: 3500 },
  { key: "barba", name: "Barba", durationMinutes: 20, priceCents: 2500 },
  { key: "combo", name: "Corte + Barba", durationMinutes: 50, priceCents: 5500 },
  { key: "sobrancelha", name: "Sobrancelha", durationMinutes: 15, priceCents: 1500 },
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

const WEEKDAY_HOURS = [
  { startTime: "09:00", endTime: "12:00" },
  { startTime: "13:00", endTime: "19:00" },
];
const SATURDAY_HOURS = [{ startTime: "08:00", endTime: "14:00" }];

// dayOfWeek: 0 = domingo ... 6 = sábado
const PROFESSIONALS: { name: string; services: ServiceKey[]; days: number[] }[] = [
  { name: "João", services: ["corte", "barba", "combo", "sobrancelha"], days: [2, 3, 4, 5, 6] },
  { name: "Pedro", services: ["corte", "barba", "combo"], days: [2, 3, 4, 5, 6] },
  { name: "Ana", services: ["corte", "sobrancelha"], days: [1, 2, 3, 4, 5] },
];

const CUSTOMERS = [
  "Maria Silva", "José Santos", "Ana Oliveira", "Carlos Souza", "Fernanda Lima",
  "Rafael Costa", "Juliana Pereira", "Bruno Almeida", "Camila Rocha", "Lucas Ferreira",
  "Patrícia Gomes", "Thiago Ribeiro",
];

export async function seedDemo(prisma: PrismaClient, now = new Date()) {
  const random = seededRandom(20261110);

  // 1. Apaga a conta demo anterior. O CASCADE do banco leva junto estabelecimento, agenda etc.
  await prisma.user.deleteMany({ where: { email: DEMO.email } });

  // 2. Dono + estabelecimento
  const user = await prisma.user.create({
    data: {
      name: DEMO.ownerName,
      email: DEMO.email,
      passwordHash: await bcrypt.hash(DEMO.password, 10),
      establishments: {
        create: { name: DEMO.establishmentName, slug: DEMO.slug, timezone: DEMO.timezone },
      },
    },
    include: { establishments: true },
  });
  const establishmentId = user.establishments[0]!.id;

  // 3. Serviços
  const services = new Map<ServiceKey, { id: string; durationMinutes: number; priceCents: number }>();
  for (const { key, ...data } of SERVICES) {
    services.set(key, await prisma.service.create({ data: { ...data, establishmentId } }));
  }

  // 4. Profissionais, com os serviços que fazem e o expediente da semana
  const professionals = [];
  for (const p of PROFESSIONALS) {
    const workingHours = p.days.flatMap((day) =>
      (day === 6 ? SATURDAY_HOURS : WEEKDAY_HOURS).map((range) => ({ dayOfWeek: day, ...range })),
    );
    const created = await prisma.professional.create({
      data: {
        name: p.name,
        establishmentId,
        services: { create: p.services.map((key) => ({ serviceId: services.get(key)!.id })) },
        workingHours: { create: workingHours },
      },
    });
    professionals.push({ id: created.id, services: p.services.map((key) => services.get(key)!), workingHours });
  }

  // 5. Clientes
  const customers = await prisma.customer.createManyAndReturn({
    data: CUSTOMERS.map((name, i) => ({
      name,
      email: `${slugifyName(name)}@example.com`,
      phone: `819${String(90000000 + i * 1234567).slice(0, 8)}`,
      establishmentId,
    })),
  });

  // 6. Agendamentos: percorre cada dia e cada expediente preenchendo horários.
  //    Como cada profissional só "anda para frente" no tempo, nunca há sobreposição (e a constraint do banco confere).
  const appointments = [];
  const today = localToday(DEMO.timezone, now);

  for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
    const date = addDays(today, offset);

    for (const professional of professionals) {
      for (const range of professional.workingHours.filter((h) => h.dayOfWeek === dayOfWeek(date))) {
        let cursor = timeToMinutes(range.startTime);
        const rangeEnd = timeToMinutes(range.endTime);

        while (cursor < rangeEnd) {
          const service = pick(random, professional.services);
          if (cursor + service.durationMinutes > rangeEnd) break;

          const startAt = localDateTimeToUtc(date, minutesToTime(cursor), DEMO.timezone);
          const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

          // Passado bem cheio (parece uma barbearia de verdade); futuro com espaço para agendar na demo.
          const fillRate = startAt < now ? 0.7 : 0.35;
          if (random() >= fillRate) {
            cursor += 15;
            continue;
          }

          const status = pickStatus(random, startAt, endAt, now);
          // Criado de 1 a 10 dias antes (nunca no futuro).
          const createdAt = new Date(Math.min(now.getTime(), startAt.getTime()) - (1 + Math.floor(random() * 10)) * DAY_MS);

          appointments.push({
            establishmentId,
            professionalId: professional.id,
            serviceId: service.id,
            customerId: pick(random, customers).id,
            startAt,
            endAt,
            priceCentsAtBooking: service.priceCents,
            status,
            cancelToken: randomBytes(32).toString("base64url"),
            createdAt,
            // Marca o lembrete como já enviado: o job nunca manda e-mail para os clientes fictícios.
            reminderSentAt: status === "CANCELED" ? null : now,
          });

          cursor += Math.ceil(service.durationMinutes / 15) * 15; // próximo horário na grade de 15 min
        }
      }
    }
  }

  await prisma.appointment.createMany({ data: appointments });

  return { establishmentId, appointments: appointments.length };
}

function pickStatus(random: () => number, startAt: Date, endAt: Date, now: Date): AppointmentStatus {
  const r = random();
  if (endAt <= now) return r < 0.82 ? "COMPLETED" : r < 0.92 ? "NO_SHOW" : "CANCELED"; // já aconteceu
  if (startAt <= now) return "SCHEDULED"; // acontecendo agora
  return r < 0.9 ? "SCHEDULED" : "CANCELED"; // futuro
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function slugifyName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");
}

// Mulberry32: gerador pseudoaleatório simples com semente. Mesma semente = mesma sequência.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
