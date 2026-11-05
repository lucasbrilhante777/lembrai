# ADR 0002: Datas em UTC e timezone do estabelecimento

- **Status:** Aceito
- **Data:** 2026-11-04

## Contexto

O sistema lida com horários em três lugares que podem estar em fusos diferentes:

- o **servidor** (Render/Railway normalmente roda em UTC);
- o **estabelecimento** (uma barbearia em Recife trabalha das 09:00 às 18:00 no horário local);
- o **navegador** do cliente ou do dono, que pode estar em outro fuso ou com o relógio configurado errado.

Se as datas forem gravadas "como vieram", sem fuso, aparecem bugs clássicos: horário deslocado em 3 horas no deploy, lembrete enviado na hora errada e problemas em regiões ou anos com horário de verão.

## Decisão

1. **Todo instante é gravado em UTC.** `startAt`, `endAt`, `reminderSentAt` e `createdAt` usam `timestamptz` no Postgres (`@db.Timestamptz` no Prisma).
2. **O estabelecimento tem um fuso IANA** (`Establishment.timezone`, ex.: `America/Recife`), escolhido no cadastro.
3. **O expediente é guardado como horário local**, sem data: `WorkingHours.startTime = "09:00"` significa 09:00 *no fuso do estabelecimento*.
4. **O cálculo de horários livres acontece no fuso do estabelecimento.** Para um dia pedido, o back monta os horários locais a partir do `WorkingHours`, converte para UTC com `date-fns-tz` e só então compara com os agendamentos do banco.
5. **A API recebe e devolve datas em ISO 8601 com fuso** (ex.: `2026-11-10T12:00:00.000Z`). O front exibe sempre no **fuso do estabelecimento**, não no do navegador: o cliente quer saber a hora em que precisa estar na barbearia.

## Consequências

**Positivas**
- Um único padrão de armazenamento: comparar, ordenar e somar intervalos é sempre seguro.
- O deploy em qualquer região não muda nenhum horário.
- O job de lembretes compara `startAt` com `now()` em UTC, sem conversões.

**Negativas**
- Toda exibição e todo cálculo de slots exigem conversão explícita de fuso.
- Precisa de testes específicos: dia com horário de verão (usando um fuso que ainda tenha, como `America/New_York`) e servidor rodando em fuso diferente do estabelecimento.
