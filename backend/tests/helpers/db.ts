import { prisma } from "../../src/lib/prisma.js";

// Apaga todos os dados entre os testes. O CASCADE segue as chaves estrangeiras
// a partir de "User", então limpa estabelecimentos, agendamentos etc. junto.
export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
}
