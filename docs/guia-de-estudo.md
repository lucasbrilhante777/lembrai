# Guia de estudo do Lembrai

Este guia explica os conceitos usados no Lembrai: **o que são**, **onde aparecem no código** e **como explicar em uma entrevista**. A ideia é que você consiga defender cada decisão do projeto com as suas palavras.

Cada seção termina com um bloco **🎤 Em entrevista**, uma resposta curta que você pode adaptar. No fim há uma lista de perguntas para revisar e um glossário.

> Dica de estudo: não decore as respostas. Leia a seção, abra o arquivo indicado, encontre a linha no código e tente explicar em voz alta sem olhar o texto.

---

## Sumário

1. [Visão geral: como as peças se conectam](#1-visão-geral-como-as-peças-se-conectam)
2. [Git, Pull Request, CI e merge](#2-git-pull-request-ci-e-merge)
3. [API REST e códigos de status HTTP](#3-api-rest-e-códigos-de-status-http)
4. [Organização em camadas](#4-organização-em-camadas)
5. [Validação de entrada](#5-validação-de-entrada)
6. [Autenticação e segurança do login](#6-autenticação-e-segurança-do-login)
7. [Multi-tenant e IDOR](#7-multi-tenant-e-idor)
8. [Modelagem do banco de dados](#8-modelagem-do-banco-de-dados)
9. [Concorrência e race conditions](#9-concorrência-e-race-conditions)
10. [Datas e fuso horário](#10-datas-e-fuso-horário)
11. [Jobs agendados e idempotência](#11-jobs-agendados-e-idempotência)
12. [E-mails](#12-e-mails)
13. [Máquina de estados](#13-máquina-de-estados)
14. [Testes](#14-testes)
15. [Front-end](#15-front-end)
16. [Conta demo (seed)](#16-conta-demo-seed)
17. [Como revisar código feito por IA](#17-como-revisar-código-feito-por-ia)
18. [Perguntas para revisar](#18-perguntas-para-revisar)
19. [Glossário](#19-glossário)

---

## 1. Visão geral: como as peças se conectam

```
 Navegador (React)            API (Node + Express)                PostgreSQL
 ─────────────────           ────────────────────                ──────────
 /agenda/barbearia-demo  ──► rotas → controller → service  ──►   tabelas + regras
         ▲  fetch("/api/...")         │                           (constraints)
         │                            ├──► e-mail (SMTP)  ──► Mailpit (dev) / Resend (prod)
         └────── JSON ◄───────────────┘
                                      ▲
                       job a cada 15 min (lembretes)
```

O caminho de um agendamento:

1. O cliente escolhe o horário na página e clica em "Confirmar".
2. O front faz `POST /api/public/establishments/:slug/appointments`.
3. A API valida os dados (Zod), confere se o horário ainda está livre e grava no banco.
4. O **banco** tem a palavra final: uma regra (constraint) impede dois agendamentos sobrepostos.
5. A API envia o e-mail de confirmação e responde `201 Created`.
6. Perto do horário, o **job** de lembretes envia o e-mail de lembrete.

🎤 **Em entrevista:** "É um SaaS de agendamento. Front em React, API REST em Node com Express e TypeScript, e PostgreSQL com Prisma. As regras mais críticas, como não ter dois clientes no mesmo horário, são garantidas pelo próprio banco, e a API traduz os erros em respostas amigáveis. Um job periódico envia os lembretes por e-mail."

---

## 2. Git, Pull Request, CI e merge

### Commit, branch e push
- **Commit**: uma "foto" do código, com uma mensagem do que mudou.
- **Branch**: uma linha de trabalho paralela. A `main` é a oficial. Cada funcionalidade nasce numa branch (`feature/criar-agendamento`), então a `main` nunca fica quebrada.
- **Push**: enviar seus commits para o GitHub.

### Pull Request (PR)
O pedido de "juntar minha branch na `main`". É onde fica a descrição da mudança, o diff (linha por linha), o resultado do CI e a revisão.

### CI: Integração Contínua
Um robô que, a cada push ou PR, cria um computador limpo e roda verificações. No Lembrai ([.github/workflows/ci.yml](../.github/workflows/ci.yml)):

| Job | Passos |
|---|---|
| **Backend** | sobe um Postgres → `npm ci` → typecheck → testes → build |
| **Frontend** | `npm ci` → lint → typecheck → testes → build |

- **CI passou (✅):** todos os comandos terminaram com código de saída `0`.
- **CI falhou (❌):** algum comando deu erro. O log mostra qual e por quê.
- ✅ não significa "código perfeito", e sim "**nada do que verificamos quebrou**". O que não tem teste, o CI não pega.

**Caso real do projeto:** na etapa de serviços, os testes passaram, mas o *typecheck* falhou (um erro de tipo que o Vitest não verifica). É exatamente o tipo de erro que o CI segura.

### Merge e squash
- **Merge**: juntar a branch na `main`.
- **Squash merge**: os vários commits da branch viram **um** commit na `main`, com o título do PR e o número dele (`... (#2)`). O histórico fica com uma linha por funcionalidade.

### Proteção da branch `main`
Configurada no GitHub: só entra código por PR, com o CI verde, e nem o dono do repositório pula as regras. Push direto na `main` é recusado.

### CI x CD
- **CI**: verificar cada mudança automaticamente.
- **CD** (Continuous Delivery/Deployment): publicar automaticamente o que entrou na `main` (Vercel e Render fazem isso no deploy).

🎤 **Em entrevista:** "Uso uma branch por funcionalidade e PR com descrição. O CI roda lint, typecheck, testes contra um Postgres real e build. A `main` é protegida: só entra código com CI verde, e faço squash merge pra ter um histórico limpo, um commit por funcionalidade."

---

## 3. API REST e códigos de status HTTP

**REST** é um estilo de API em que cada URL representa um recurso (`/services`, `/appointments`) e o verbo HTTP diz a ação:

| Verbo | Uso no Lembrai |
|---|---|
| `GET` | Ler (lista de serviços, horários livres) |
| `POST` | Criar (agendamento, cadastro) ou disparar uma ação (`/cancel`) |
| `PATCH` | Alterar parte de algo (preço de um serviço, status) |
| `PUT` | Substituir por inteiro (o expediente da semana de um profissional) |

**Códigos de status usados no projeto:**

| Código | Significado | Exemplo no Lembrai |
|---|---|---|
| `200 OK` | Deu certo | Listar serviços |
| `201 Created` | Criou algo | Agendamento criado |
| `204 No Content` | Deu certo, sem corpo | Logout |
| `400 Bad Request` | Dados inválidos | E-mail sem `@`, data no passado |
| `401 Unauthorized` | Não está logado | Acessar `/services` sem cookie |
| `404 Not Found` | Não existe (**ou não é seu**) | Serviço de outro estabelecimento |
| `409 Conflict` | Conflita com o estado atual | Horário acabou de ser ocupado |
| `429 Too Many Requests` | Muitas tentativas | Rate limit do login |
| `500 Internal Server Error` | Erro inesperado | Bug: o detalhe vai pro log, não pro cliente |

**Por que 404 e não 403 para dados de outro dono?** O 403 diria "isso existe, mas não é seu", o que já é informação. O 404 não confirma nem que existe.

**Por que o `GET` nunca altera nada?** Leitores de e-mail e antivírus abrem links sozinhos. Se `GET /cancelar/...` cancelasse, o agendamento sumiria sem o cliente clicar. Por isso o link mostra a página, e quem cancela é um `POST` ([cancellation.service.ts](../backend/src/services/cancellation.service.ts)).

🎤 **Em entrevista:** "Uso os status certos para cada caso: 409 quando o horário foi ocupado, 404 em vez de 403 para não revelar que um recurso de outro cliente existe, e GET nunca altera estado, o que importou no link de cancelamento do e-mail."

---

## 4. Organização em camadas

Cada pasta do backend tem uma responsabilidade:

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Rotas | `src/routes/` | Liga URL + verbo ao controller |
| Controllers | `src/controllers/` | Traduz HTTP: valida a entrada e monta a resposta |
| Services | `src/services/` | Regras de negócio + banco |
| Domínio | `src/domain/` | **Funções puras** (sem banco, sem relógio): cálculo de horários, regras de status |
| Middlewares | `src/middlewares/` | Executados antes das rotas: login, rate limit, erros |

**Função pura** recebe tudo por parâmetro e não acessa nada de fora (banco, relógio, rede). Para o mesmo resultado, a mesma entrada. É fácil de testar e de entender. Exemplo: [availability.ts](../backend/src/domain/availability.ts) recebe até o "agora" (`now`) como parâmetro, então o teste controla o tempo.

**Tratamento de erros centralizado** ([error-handler.ts](../backend/src/middlewares/error-handler.ts)): todo erro passa por um lugar só. Erro esperado (`AppError`) vira a mensagem e o status certos. Erro inesperado vai pro log, e o cliente vê só "Erro interno", sem vazar detalhe técnico.

**`createApp()` sem `listen()`** ([app.ts](../backend/src/app.ts)): os testes usam o app direto, sem abrir porta.

🎤 **Em entrevista:** "Separei em rotas, controllers, services e domínio. As regras mais delicadas, como cálculo de horários livres e transições de status, são funções puras, testadas sem banco. Os erros são tratados num middleware central, que nunca vaza detalhe interno para o cliente."

---

## 5. Validação de entrada

**Regra de ouro: nunca confie no que vem do cliente.** Qualquer um pode chamar a API direto, sem passar pela tela.

- **Zod** valida e transforma toda entrada (`src/schemas/`): e-mail vira minúsculo, telefone fica só com dígitos, data precisa estar em `AAAA-MM-DD`.
- As variáveis de ambiente também são validadas ([env.ts](../backend/src/config/env.ts)): se faltar algo, a API nem sobe.
- **Exemplo forte:** ao criar um agendamento, a API **recalcula** os horários livres e só aceita um horário que esteja na lista. Quem chamar a API direto não consegue marcar às 09:07 ou num horário passado ([public.service.ts](../backend/src/services/public.service.ts)).
- A senha tem limite de **72 caracteres** porque o bcrypt ignora o que passa disso.

🎤 **Em entrevista:** "Toda entrada passa por um schema Zod. E não confio no front: na criação do agendamento, a API recalcula os horários livres e só aceita um que esteja disponível."

---

## 6. Autenticação e segurança do login

| Conceito | O que é | No Lembrai |
|---|---|---|
| **Hash de senha (bcrypt)** | A senha vira um "resumo" que não dá para reverter. O banco nunca guarda a senha | [auth.service.ts](../backend/src/services/auth.service.ts) |
| **JWT** | Token assinado que diz "este é o usuário X". A API confere a assinatura com um segredo | [token.ts](../backend/src/lib/token.ts) |
| **Cookie `httpOnly`** | JavaScript da página não consegue ler o cookie | Protege o token contra **XSS** |
| **`SameSite=Lax`** | O navegador não envia o cookie em POSTs vindos de outro site | Protege contra **CSRF** |
| **Algoritmo fixo no JWT** | Só aceita `HS256` | Bloqueia o ataque de trocar o algoritmo do token |
| **Mensagem genérica** | "E-mail ou senha inválidos" nos dois casos | Ninguém descobre quais e-mails têm conta |
| **Tempo constante** | Compara com um hash falso quando o e-mail não existe | A resposta demora o mesmo tempo (contra **timing attack**) |
| **Rate limit** | Máximo de tentativas por IP | Dificulta adivinhar senha na força bruta |

- **XSS** (Cross-Site Scripting): um script malicioso rodando na sua página. Se o token estivesse no `localStorage`, o script poderia roubá-lo.
- **CSRF** (Cross-Site Request Forgery): outro site fazendo o seu navegador enviar uma requisição para a sua API, usando o seu cookie.

🎤 **Em entrevista:** "A senha é guardada com bcrypt. O login gera um JWT, que fica num cookie httpOnly com SameSite=Lax: o JavaScript não lê o token e outros sites não conseguem usá-lo. O login devolve a mesma mensagem e demora o mesmo tempo para e-mail inexistente e senha errada, para não revelar quem tem conta, e tem rate limit."

---

## 7. Multi-tenant e IDOR

**Multi-tenant**: várias empresas (estabelecimentos) usando o mesmo sistema e o mesmo banco. Cada uma só pode ver os próprios dados.

**IDOR** (Insecure Direct Object Reference): a falha em que alguém troca o id na URL (`/services/123` → `/services/124`) e acessa dados de outro cliente.

**Como o Lembrai se protege:**
- O `establishmentId` vem **do token**, nunca do corpo da requisição ([ensure-authenticated.ts](../backend/src/middlewares/ensure-authenticated.ts), função `getAuth`).
- Toda consulta filtra por ele: `where: { id, establishmentId }`.
- Recurso de outro dono responde **404**.
- **Brecha menos óbvia:** um dono poderia mandar no corpo o id de um serviço de *outro* estabelecimento para vincular ao profissional dele. `assertServicesBelongTo` confere isso ([professionals.service.ts](../backend/src/services/professionals.service.ts)).
- Há testes de isolamento em cada módulo: o dono B tenta mexer nos dados do dono A, e o teste confere que nada mudou.

🎤 **Em entrevista:** "É multi-tenant: toda consulta filtra pelo estabelecimento que vem do token, nunca de um id enviado pelo cliente. Tenho testes de IDOR em cada módulo, inclusive para o caso de vincular um recurso de outro estabelecimento passando o id no corpo."

---

## 8. Modelagem do banco de dados

Arquivo: [schema.prisma](../backend/prisma/schema.prisma).

| Decisão | Por quê |
|---|---|
| Preço em **centavos** (`3500` = R$ 35,00) | Número com vírgula (float) tem erro de arredondamento em dinheiro |
| `priceCentsAtBooking` no agendamento | **Snapshot**: mudar o preço do serviço não altera o histórico nem o faturamento antigo |
| `ProfessionalService` (N:N) | Nem todo profissional faz todo serviço |
| `active` em vez de apagar | Apagar quebraria o histórico de agendamentos (é o chamado **soft delete**) |
| `Customer` único por (estabelecimento, e-mail) | O cliente não tem login; é identificado pelo e-mail em cada estabelecimento |
| `cancelToken` aleatório de 256 bits | Impossível de adivinhar, então só quem recebeu o e-mail consegue cancelar |

**Constraints** são regras que o próprio banco garante, mesmo que a API tenha um bug ([migration](../backend/prisma/migrations/20261105183610_init/migration.sql)):
- `UNIQUE`: e-mail do usuário, slug, token.
- `CHECK`: fim depois do início, preço não negativo, dia da semana de 0 a 6, horário no formato "HH:MM".
- `EXCLUDE`: dois agendamentos do mesmo profissional não podem se sobrepor (ver seção 9).

**Migration** é um arquivo SQL versionado que leva o banco de um estado para o próximo. Fica no Git e roda igual em todo ambiente (sua máquina, CI e produção).

🎤 **Em entrevista:** "Dinheiro em centavos, preço copiado para o agendamento para preservar o histórico, desativação em vez de exclusão, e regras críticas como constraints no banco, que é a última linha de defesa."

---

## 9. Concorrência e race conditions

**Race condition**: quando o resultado depende de quem chega primeiro, e duas operações ao mesmo tempo produzem um estado errado.

**O caso clássico do Lembrai:**
```
Cliente A: "09:00 está livre?" → sim
Cliente B: "09:00 está livre?" → sim     (A ainda não gravou)
Cliente A: grava 09:00
Cliente B: grava 09:00                   ← dois clientes no mesmo horário!
```

**Solução em duas camadas** ([ADR 0001](adr/0001-prevencao-de-conflito-de-agenda.md)):
1. A API confere os horários livres (pega o caso comum e dá uma mensagem amigável).
2. O **banco** tem uma *exclusion constraint*: para o mesmo profissional, os intervalos de tempo não podem se cruzar. Se dois pedidos chegarem juntos, o segundo é recusado com o erro `23P01`, e a API transforma isso em **409**.

**Outros padrões de concorrência no projeto:**

| Padrão | Onde | Como funciona |
|---|---|---|
| **Controle otimista** | Mudança de status pelo dono ([appointments.service.ts](../backend/src/services/appointments.service.ts)) | `UPDATE ... WHERE status = <o que eu li>`. Se outra pessoa mudou no meio, 0 linhas são alteradas, e o dono recebe "acabou de ser alterado" em vez de sobrescrever em silêncio |
| **Reserva atômica** | Job de lembretes ([reminders.job.ts](../backend/src/jobs/reminders.job.ts)) | `UPDATE ... WHERE reminderSentAt IS NULL`. Só uma execução consegue "reservar" o envio |

**Como foi provado:** testes com `Promise.all` (dois pedidos ao mesmo tempo) e um teste que **força** o caminho da constraint, fazendo a checagem da API "não enxergar" o conflito. Para garantir que esse teste vale, a conversão do erro foi desligada de propósito, e o teste falhou com 500. Isso é um **teste de mutação** (seção 14).

🎤 **Em entrevista:** "O risco era dois clientes pegarem o mesmo horário ao mesmo tempo. A checagem na aplicação não resolve isso sozinha, por causa da race condition. Coloquei uma exclusion constraint no Postgres, com ranges de tempo por profissional, e a API traduz a violação em 409. Tenho teste com requisições simultâneas e um teste que força o caminho da constraint."

---

## 10. Datas e fuso horário

Ver [ADR 0002](adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md).

- **UTC** é o "horário universal". Todo instante é **guardado** em UTC (`timestamptz`).
- O estabelecimento tem um fuso **IANA** (`America/Recife`). O expediente ("09:00") é horário **local**.
- A conversão acontece na borda: horário local → UTC para gravar e comparar; UTC → local para exibir.
- **Horário de verão (DST):** o mesmo "09:00" local corresponde a instantes UTC diferentes antes e depois da virada. Há teste com `America/New_York`.
- **O "dia" é o dia local:** um corte às 23:30 em Recife é 02:30 UTC do dia seguinte. A agenda consulta de meia-noite a meia-noite **no fuso do estabelecimento**.
- No front, datas de calendário (`"2026-11-17"`) são formatadas como UTC ao meio-dia, para o fuso do navegador não "voltar" um dia.

🎤 **Em entrevista:** "Guardo tudo em UTC e o estabelecimento tem um fuso IANA. O expediente é horário local, e converto na borda. Testei a virada do horário de verão e o caso de um horário às 23:30, que em UTC já é o dia seguinte."

---

## 11. Jobs agendados e idempotência

- **Job**: tarefa que roda sozinha de tempos em tempos. O de lembretes roda a cada 15 minutos (`node-cron`, [scheduler.ts](../backend/src/jobs/scheduler.ts)).
- **Idempotente**: rodar uma vez ou dez vezes dá o mesmo resultado. Cada lembrete sai **uma vez só**, mesmo se o job rodar duas vezes ao mesmo tempo (ex.: duas cópias da API no ar).

Como o job funciona ([reminders.job.ts](../backend/src/jobs/reminders.job.ts)):
1. Busca agendamentos marcados, sem lembrete enviado, que começam nas próximas 24h.
2. "Reserva" cada um (`reminderSentAt` vai de vazio para a data), de forma atômica.
3. Envia o e-mail. **Se falhar, desfaz a reserva**, e a próxima rodada tenta de novo.

Outros detalhes: `noOverlap` (uma rodada não começa por cima da anterior), `try/catch` na rodada (um erro não derruba a API) e a regra de não lembrar quem agendou com menos de 24h de antecedência (essa pessoa acabou de receber a confirmação).

🎤 **Em entrevista:** "O lembrete é idempotente: antes de enviar, o job reserva o agendamento com um UPDATE condicional, e só quem consegue a reserva envia. Se o envio falha, a reserva é desfeita para tentar de novo. Testei duas execuções simultâneas."

---

## 12. E-mails

- **SMTP**: o protocolo de envio de e-mail. A API usa o Nodemailer.
- **Mailpit** (no `docker-compose.yml`): uma caixa de e-mail falsa para desenvolvimento. Tudo aparece em http://localhost:8025, e nada sai para a internet.
- **Escape de HTML** ([appointment-emails.ts](../backend/src/emails/appointment-emails.ts)): se alguém se cadastrar com o nome `<a href="site-de-golpe">`, isso apareceria como link no e-mail. Tudo que o usuário digita é "escapado" (`<` vira `&lt;`).
- **Falha no e-mail não desfaz o agendamento**: o horário já está garantido no banco. Punir o cliente porque o servidor de e-mail caiu seria pior.
- O **token de cancelamento** nunca volta na resposta da API, só vai por e-mail.
- O teste manual achou um problema que os automáticos não acharam: o assunto dizia "amanhã", o que ficaria errado se o job atrasasse. Agora ele usa a data explícita.

🎤 **Em entrevista:** "Os e-mails escapam o HTML dos dados do usuário, uma falha no envio não desfaz o agendamento e o link de cancelamento usa GET só para mostrar, com o cancelamento num POST, por causa dos leitores de e-mail que abrem links."

---

## 13. Máquina de estados

Um agendamento passa por **estados**, e só algumas transições são permitidas ([appointment-status.ts](../backend/src/domain/appointment-status.ts)):

```
               ┌──► CANCELED              (só antes do horário; definitivo)
  SCHEDULED ───┤
               └──► COMPLETED ◄──► NO_SHOW (só depois que o horário começou)
```

- Cancelado é **definitivo**: o horário pode já ter sido pego por outra pessoa.
- Concluído e falta podem ser trocados entre si, para corrigir um clique errado.
- Repetir o mesmo status não é erro (idempotente) e não reenvia e-mail.

🎤 **Em entrevista:** "Modelei o status como uma máquina de estados numa função pura, com as transições permitidas e o motivo de cada uma. Ela é testada isoladamente, com todas as combinações."

---

## 14. Testes

### Tipos de teste no projeto
| Tipo | O que testa | Exemplo |
|---|---|---|
| **Unitário** | Uma função isolada, sem banco | [availability.test.ts](../backend/tests/availability.test.ts), [appointment-status.test.ts](../backend/tests/appointment-status.test.ts) |
| **Integração** | API + regras + banco de verdade | [booking.test.ts](../backend/tests/booking.test.ts) |
| **Componente (front)** | A tela usada como um usuário usaria | [BookingPage.test.tsx](../frontend/src/features/booking/BookingPage.test.tsx) |
| **Manual (ponta a ponta)** | O sistema inteiro rodando | Agendar no navegador e ver o e-mail no Mailpit |

### Técnicas que valem citar
- **Banco de teste separado** (`lembrai_test`), criado e migrado antes dos testes ([global-setup.ts](../backend/tests/global-setup.ts)). Os testes podem apagar tudo sem afetar o banco de desenvolvimento.
- **Mock / spy** (`vi.spyOn`): substituir uma peça por uma falsa para simular situações. Ex.: o servidor de e-mail falhando, ou a checagem de horários "não vendo" um conflito.
- **Injeção do tempo** (`now` como parâmetro): o teste controla o "agora" sem esperar o relógio.
- **Teste de mutação**: quebrar o código de propósito para confirmar que o teste falha. Se ele continuar passando, não testa nada.
- **Determinismo**: o seed usa um gerador aleatório com **semente fixa**, então gera sempre os mesmos dados e o teste não é "às vezes passa, às vezes falha" (*flaky*).
- **Testes de front pela tela**: clicar em "Corte", digitar em "Seu nome", conferir o que aparece. Não testam detalhes internos, então continuam valendo se o componente for reescrito.

🎤 **Em entrevista:** "Tenho testes unitários para a lógica pura, de integração contra um Postgres real para a API e de componente no front, simulando o usuário. Para as partes de concorrência, forcei os cenários com mocks e confirmei com teste de mutação que os testes realmente pegam o erro."

---

## 15. Front-end

- **React** monta a tela a partir do **estado** (o que está escolhido). Mudou o estado, a tela se atualiza.
- **Componentes**: peças reutilizáveis (`OptionButton`, `Step`, `Alert` em [ui.tsx](../frontend/src/components/ui.tsx)).
- **TanStack Query** cuida das chamadas à API: cache, "carregando", erro e recarregar. Depois de agendar (ou de um 409), ele recarrega os horários livres sozinho.
- **Proxy `/api`** ([vite.config.ts](../frontend/vite.config.ts)): o front chama `/api/...`, e o Vite repassa para a API. Para o navegador, é tudo o mesmo site, então o cookie de login funciona sem CORS entre domínios. Em produção, a Vercel faz o mesmo.
- **Estado "levantado" (lifting state up)**: os dados do cliente ficam na página, não no formulário. Assim, se o horário for ocupado e o formulário sumir, o que foi digitado não se perde.
- **Acessibilidade**: `aria-pressed` nos botões de escolha, `label` em cada campo, erros ligados ao campo (`aria-describedby`, `aria-invalid`) e foco visível. Leitores de tela conseguem usar a página, e os testes acham os elementos pelos mesmos nomes.

🎤 **Em entrevista:** "No front, uso React Query para o estado do servidor e um proxy para manter front e API na mesma origem, o que simplifica o cookie de login. Tratei o 409 sem perder o que o usuário digitou, e a página é acessível, com labels e atributos ARIA."

---

## 16. Conta demo (seed)

- **Seed**: script que popula o banco com dados de exemplo ([seed-demo.ts](../backend/src/demo/seed-demo.ts)). Roda com `npm run db:seed`.
- **Idempotente**: recria só a conta demo e não toca nas outras.
- **Domínio `@example.com`**: reservado pela RFC 2606 para exemplos, então nenhum e-mail chega a uma pessoa real. Os agendamentos já saem com o lembrete marcado como enviado, então o job nem tenta.
- **Semente fixa**: dados "aleatórios", mas reproduzíveis.

---

## 17. Como revisar código feito por IA

Use isto em todo PR:

1. **Consigo explicar a mudança com as minhas palavras?** Se não, pergunte antes de aprovar.
2. **O CI está verde?** Nunca faça merge com ❌.
3. **Cada regra nova tem teste?** Para cada "não pode X", procure o teste que prova.
4. **O teste testa de verdade?** Peça: "prova que esse teste pega o erro" (teste de mutação).
5. **E se dois usuários fizerem isso ao mesmo tempo?** (seção 9)
6. **Quem pode chamar essa rota? Um dono acessa dados de outro?** (seção 7)
7. **O que vem do usuário é validado? Aparece em HTML sem escape?** (seções 5 e 12)
8. **Algum dado sensível volta na resposta?** (senha, token, dados de outro cliente)
9. **Testei a parte visível na mão?**
10. **Tem um jeito mais simples?**

Frases úteis para pedir à IA:
- "Explica essa parte como se eu fosse júnior."
- "Qual o pior caso aqui?"
- "Isso está testado? Me mostra o teste."
- "Por que você escolheu X e não Y?"

---

## 18. Perguntas para revisar

Tente responder sozinho antes de olhar a seção indicada.

1. Qual a diferença entre CI e CD? *(2)*
2. O que significa "o CI passou"? CI verde garante que o código está certo? *(2)*
3. Por que squash merge? *(2)*
4. Quando usar 400, 401, 404 e 409? *(3)*
5. Por que responder 404 em vez de 403 para dados de outro cliente? *(3, 7)*
6. Por que o link de cancelamento não cancela no GET? *(3, 12)*
7. O que é uma função pura e por que ela facilita os testes? *(4)*
8. Por que validar na API se o front já valida? *(5)*
9. Por que guardar o token num cookie httpOnly em vez do localStorage? *(6)*
10. O que são XSS e CSRF? Como o projeto se protege de cada um? *(6, 12)*
11. Como o login evita revelar quais e-mails têm conta? *(6)*
12. O que é IDOR? Como você testou que não acontece? *(7)*
13. Por que dinheiro em centavos? *(8)*
14. Por que copiar o preço para o agendamento? *(8)*
15. O que é uma race condition? Dê o exemplo do projeto. *(9)*
16. Por que a checagem na aplicação não basta contra agendamento duplicado? *(9)*
17. O que é controle de concorrência otimista? *(9)*
18. Por que guardar em UTC? O que quebra com horário de verão? *(10)*
19. O que é idempotência? Como o job garante um lembrete só? *(11)*
20. O que acontece se o e-mail de confirmação falhar? *(12)*
21. Desenhe a máquina de estados do agendamento. *(13)*
22. Diferença entre teste unitário e de integração? *(14)*
23. O que é teste de mutação? *(14)*
24. Por que os testes usam um banco separado? *(14)*
25. Para que serve o proxy `/api` do front? *(15)*

---

## 19. Glossário

| Termo | Significado |
|---|---|
| **ADR** | Architecture Decision Record: um documento curto explicando uma decisão técnica e o porquê (`docs/adr/`) |
| **API REST** | API em que URLs são recursos e verbos HTTP são ações |
| **bcrypt** | Algoritmo de hash de senha, propositalmente lento |
| **Branch** | Linha paralela de trabalho no Git |
| **CI/CD** | Integração contínua / entrega contínua |
| **Constraint** | Regra garantida pelo banco (UNIQUE, CHECK, EXCLUDE) |
| **CORS** | Regra do navegador sobre chamadas entre sites diferentes |
| **CSRF** | Ataque em que outro site usa o seu cookie para fazer requisições |
| **DST** | Horário de verão |
| **Flaky** | Teste que às vezes passa e às vezes falha sem mudança no código |
| **Hash** | "Resumo" irreversível de um dado |
| **Idempotente** | Rodar várias vezes dá o mesmo resultado que rodar uma |
| **IDOR** | Acessar dados de outro cliente trocando um id |
| **JWT** | Token assinado que identifica o usuário |
| **Merge / Squash** | Juntar a branch na main / juntando tudo em um commit |
| **Middleware** | Função que roda antes das rotas (login, rate limit, erros) |
| **Migration** | Arquivo versionado que altera a estrutura do banco |
| **Mock / Spy** | Peça falsa ou "espiã" usada em testes |
| **Multi-tenant** | Vários clientes no mesmo sistema, com dados isolados |
| **ORM** | Biblioteca que mapeia tabelas para código (Prisma) |
| **PR** | Pull Request: pedido para juntar uma branch na main |
| **Race condition** | Erro causado por duas operações simultâneas |
| **Rate limit** | Limite de requisições por tempo |
| **Seed** | Script que popula o banco com dados de exemplo |
| **Snapshot** | Cópia de um valor no momento (ex.: o preço no agendamento) |
| **Soft delete** | Desativar em vez de apagar |
| **SMTP** | Protocolo de envio de e-mail |
| **SQLSTATE** | Código de erro padronizado do banco (ex.: `23P01`) |
| **Timing attack** | Descobrir informação medindo o tempo de resposta |
| **UTC / IANA** | Horário universal / nome padrão de fuso (`America/Recife`) |
| **XSS** | Script malicioso rodando na página ou no e-mail |
