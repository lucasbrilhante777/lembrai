# ADR 0001: Prevenção de conflito de agenda no banco de dados

- **Status:** Aceito
- **Data:** 2026-11-04

## Contexto

A página pública permite que qualquer pessoa agende sem login. A abordagem ingênua para evitar dois agendamentos no mesmo horário é:

1. consultar se existe agendamento do profissional que se cruza com o horário pedido;
2. se não existir, inserir.

Isso tem uma **race condition**: se dois clientes confirmam o mesmo horário quase ao mesmo tempo, as duas requisições fazem a consulta antes de qualquer uma inserir. As duas veem o horário livre e as duas inserem. O resultado é o profissional com dois clientes no mesmo horário, que é justamente o problema que o produto promete resolver.

A checagem no código continua útil para mostrar só horários livres e para dar uma mensagem amigável, mas ela **não garante** a regra.

## Decisão

A regra "um profissional não pode ter dois agendamentos ativos que se sobrepõem" é garantida pelo **PostgreSQL**, com uma *exclusion constraint*:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status <> 'CANCELED');
```

- `tstzrange(..., '[)')` trata o intervalo como fechado no início e aberto no fim. Assim, um atendimento que termina às 10:00 não conflita com outro que começa às 10:00.
- `WHERE (status <> 'CANCELED')` libera o horário quando um agendamento é cancelado.
- O `btree_gist` é necessário para combinar a igualdade de `professionalId` com a sobreposição de intervalos no mesmo índice GiST.

O Prisma não declara exclusion constraints no `schema.prisma`. A constraint fica numa **migration com SQL manual** (`npx prisma migrate dev --create-only` e depois a edição do arquivo `.sql`). As colunas `startAt`/`endAt` usam `@db.Timestamptz` (ver [ADR 0002](0002-datas-em-utc-e-timezone-do-estabelecimento.md)).

Na API, a violação da constraint (SQLSTATE `23P01`, `exclusion_violation`) é capturada no serviço de agendamento e convertida em **HTTP 409 Conflict** com a mensagem "Esse horário acabou de ser ocupado. Escolha outro."

## Consequências

**Positivas**
- A regra vale para qualquer caminho de escrita: API, seed, script ou acesso manual ao banco.
- Não depende de locks ou de nível de isolamento escolhidos no código.
- O índice GiST também acelera a consulta de horários ocupados.

**Negativas**
- Exige SQL manual numa migration, fora do que o Prisma gera.
- Prende o projeto ao PostgreSQL (aceitável: o banco já é uma escolha fixa).
- O Prisma não tem um código próprio para essa violação. Com o driver adapter (Prisma 7), o SQLSTATE original vem em `err.meta.driverAdapterError.cause.originalCode`, e é por ele que identificamos o `23P01` (`backend/src/lib/db-errors.ts`), não pelo texto da mensagem.

**Como testar** (`backend/tests/appointment-overlap.test.ts` e `backend/tests/booking.test.ts`)
- Direto no banco: inserir dois agendamentos sobrepostos e confirmar que o segundo falha, inclusive com dois `INSERT` simultâneos.
- Pela API: duas requisições simultâneas (`Promise.all`) para o mesmo horário. Exatamente uma recebe `201` e a outra `409`.
- Caminho da constraint isolado: um teste faz a checagem da aplicação "não enxergar" o agendamento existente, forçando o `INSERT` a bater na constraint, e confirma o `409` (e não `500`).
