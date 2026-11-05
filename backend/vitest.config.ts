import { defineConfig } from "vitest/config";

// Banco separado para testes: os testes podem apagar dados à vontade.
// No CI, basta definir TEST_DATABASE_URL apontando para o Postgres de lá.
process.env.TEST_DATABASE_URL ??= "postgresql://lembrai:lembrai@localhost:5432/lembrai_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Cria o banco de teste (se faltar) e aplica as migrations antes de tudo.
    globalSetup: ["tests/global-setup.ts"],
    // Os arquivos de teste compartilham o mesmo banco: rodar um por vez evita que um apague os dados do outro.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: "segredo-de-teste-com-pelo-menos-32-caracteres",
    },
  },
});
