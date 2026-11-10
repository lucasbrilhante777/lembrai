// Executado por `npx prisma db seed` (configurado em prisma7.config.ts).
import { DEMO, seedDemo } from "../src/demo/seed-demo.js";
import { prisma } from "../src/lib/prisma.js";

try {
  const { appointments } = await seedDemo(prisma);
  console.log(`✅ Conta demo criada com ${appointments} agendamentos.`);
  console.log(`   Login: ${DEMO.email} / ${DEMO.password}`);
  console.log(`   Página pública: /agenda/${DEMO.slug}`);
} finally {
  await prisma.$disconnect();
}
