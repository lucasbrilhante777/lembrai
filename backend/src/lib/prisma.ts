import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

// Uma única instância para a aplicação inteira: cada PrismaClient abre o
// próprio pool de conexões, e criar vários esgota o limite do Postgres.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
