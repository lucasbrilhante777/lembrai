import { execSync } from "node:child_process";
import pg from "pg";

// Roda uma vez antes de todos os testes.
export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL não definida.");

  await createDatabaseIfMissing(testUrl);

  // Aplica as mesmas migrations de produção, então os testes rodam contra as regras reais do banco.
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "ignore",
  });
}

async function createDatabaseIfMissing(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Nome de banco inválido: ${dbName}`);

  // Conecta no banco padrão "postgres" só para poder criar o de teste.
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();

  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
}
