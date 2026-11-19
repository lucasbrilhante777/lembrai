import { settleBackgroundTasks } from "../../src/lib/background.js";
import { prisma } from "../../src/lib/prisma.js";

// Apaga todos os dados entre os testes. O CASCADE segue as chaves estrangeiras
// a partir de "User", então limpa estabelecimentos, agendamentos etc. junto.
export async function resetDatabase() {
  // Um e-mail do teste anterior ainda pode estar saindo: espera antes de apagar os dados que ele lê.
  await settleBackgroundTasks();
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
}
