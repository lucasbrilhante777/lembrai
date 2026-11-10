import { Prisma } from "../generated/prisma/client.js";

type DriverAdapterMeta = { driverAdapterError?: { cause?: { originalCode?: string } } };

// Com driver adapter (Prisma 7), o código original do Postgres (SQLSTATE) vem dentro do meta.
// Usar o código é mais confiável do que procurar texto na mensagem de erro.
export function getPostgresErrorCode(err: unknown): string | undefined {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return (err.meta as DriverAdapterMeta | undefined)?.driverAdapterError?.cause?.originalCode;
}

/** 23P01 = exclusion_violation: a constraint anti-sobreposição de agendamentos (ADR 0001). */
export function isAppointmentOverlapError(err: unknown) {
  return getPostgresErrorCode(err) === "23P01";
}
