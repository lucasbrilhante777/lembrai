-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "professionalId" TEXT,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeOff_establishmentId_startAt_idx" ON "TimeOff"("establishmentId", "startAt");

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão: o banco recusa bloqueio que termina antes de começar (mesma regra dos agendamentos).
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_end_after_start" CHECK ("endAt" > "startAt");
