# Lembrai

[![CI](https://github.com/lucasbrilhante777/lembrai/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasbrilhante777/lembrai/actions/workflows/ci.yml)

**Agendamento online com lembretes automáticos para pequenos negócios de serviço** (barbearias, salões, clínicas, personal trainers). O cliente marca sozinho por um link, sem criar conta, e recebe um lembrete por e-mail. O dono acompanha agenda, clientes e faturamento num painel, sem caderno e sem WhatsApp.

> 🔗 **Site no ar:** https://lembraiapp.vercel.app (a primeira abertura pode levar até 1 minuto: a API está num plano gratuito que hiberna)
> 👤 **Conta demo:** `demo@example.com` / `lembrai-demo`, em https://lembraiapp.vercel.app/entrar
> 📅 **Página pública de exemplo:** https://lembraiapp.vercel.app/agenda/barbearia-demo
> 📚 **[Guia de estudo](docs/guia-de-estudo.md):** cada conceito do projeto explicado, onde está no código e como responder em entrevista

<table>
  <tr>
    <td width="32%" valign="top"><img src="docs/img/agendamento-celular.png" alt="Página pública de agendamento no celular: serviço, profissional, dia e horários livres"></td>
    <td valign="top"><img src="docs/img/agenda.png" alt="Agenda do dono: resumo do dia e atendimentos com status concluído, falta ou cancelado"></td>
  </tr>
  <tr>
    <td align="center"><sub>Cliente agenda pelo celular, sem conta</sub></td>
    <td align="center"><sub>Agenda do dono, com status e resumo do dia</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/img/relatorio.png" alt="Relatório de faturamento: receita, ticket médio, taxa de faltas, gráfico por dia e rankings"></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><sub>Relatório de faturamento: totais, receita por dia e rankings por serviço e profissional</sub></td>
  </tr>
</table>

---

## Destaques técnicos

- **Nenhum horário duplicado, nem com dois cliques no mesmo milissegundo.** A regra está no próprio Postgres (*exclusion constraint* sobre intervalos de tempo), e a API transforma a violação em `409`. Há teste com requisições simultâneas e teste de mutação provando que o caminho da constraint é exercitado. → [ADR 0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md)
- **Fuso horário correto.** Tudo é gravado em UTC, e os horários livres são calculados no fuso do estabelecimento, com teste na virada do horário de verão e na fronteira de "23:30 local = dia seguinte em UTC". → [ADR 0002](docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md)
- **Multi-tenant seguro.** Toda consulta do painel é filtrada pelo estabelecimento que vem do token, nunca de um id enviado pelo cliente. Há testes de IDOR em todos os módulos.
- **Lembretes idempotentes.** Antes de enviar, o job "reserva" o agendamento com um `UPDATE` condicional: um e-mail só, mesmo com duas instâncias da API rodando juntas.
- **Relatórios agregados no banco.** `GROUP BY` e SQL com `AT TIME ZONE` para agrupar por dia local, com valores parametrizados (sem SQL injection) e sem consultas N+1.
- **Login cuidadoso.** JWT em cookie `httpOnly` + `SameSite=Lax`, a mesma mensagem e o mesmo tempo de resposta para "e-mail não existe" e "senha errada", e rate limit.
- **Qualidade.** 180+ testes de API contra um Postgres real e ~100 testes de front simulando o usuário. O CI é obrigatório (lint, typecheck, testes e build), e o deploy é automático, só com o CI verde.
- **Deploy pensado.** Vercel (front) repassa `/api` para o Render (API), então o cookie de login funciona sem CORS entre domínios. Banco no Neon, e infraestrutura descrita em código (`render.yaml`). → [ADR 0003](docs/adr/0003-deploy-com-proxy-na-vercel.md)

## Arquitetura

```mermaid
flowchart LR
    cliente["Cliente final<br/>(celular)"] --> vercel
    dono["Dono do negócio<br/>(painel)"] --> vercel
    vercel["Vercel<br/>React + Vite"] -- "/api/* (rewrite)" --> render["Render<br/>Node + Express"]
    render --> neon[("Neon<br/>PostgreSQL")]
    render -. "confirmação e lembrete<br/>(job a cada 15 min)" .-> email["E-mail (SMTP)"]
```

O front consome a API REST do back. As rotas do painel exigem o JWT (lido do cookie). As rotas públicas (`/public/...`) não exigem login e têm rate limit. Um job agendado roda a cada 15 minutos, busca os agendamentos das próximas 24h que ainda não receberam lembrete e envia os e-mails.

---

## Sumário
- [O problema](#o-problema)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do código](#estrutura-do-código)
- [Modelo de dados](#modelo-de-dados)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Decisões técnicas](#decisões-técnicas)
- [Como rodar localmente](#como-rodar-localmente)
- [Fluxo de trabalho](#fluxo-de-trabalho)
- [Roadmap](#roadmap)

---

## O problema

Pequenos prestadores de serviço ainda controlam a agenda por WhatsApp e caderno. Isso causa:

- **Horários perdidos e conflitos:** dois clientes marcados no mesmo horário, ou horário vago que ninguém viu.
- **Faltas (no-show):** o cliente esquece, e ninguém tem tempo de lembrar um por um.
- **Tempo do dono gasto respondendo "tem horário amanhã?"** em vez de atender.

| Quem | O que precisa | Como usa o Lembrai |
|---|---|---|
| **Dono do negócio** | Menos faltas, agenda organizada, saber quanto faturou | Configura serviços, profissionais, horários e bloqueios; acompanha agenda, clientes e relatórios |
| **Cliente final** | Agendar rápido, sem cadastro | Escolhe serviço, profissional, dia e horário na página pública; cancela pelo link do e-mail |

O **profissional** (ex.: o barbeiro funcionário) tem agenda própria, mas não tem login: quem gerencia tudo é o dono.

> **Por que e-mail e não WhatsApp?** E-mail é gratuito e não depende de aprovação de API. O telefone do cliente já é coletado desde o primeiro agendamento, então a migração para WhatsApp (no [roadmap](#roadmap)) não exige mudar o modelo de dados.

## Funcionalidades

### Cliente final (sem login)
- [x] Página pública `/agenda/:slug`: serviço → profissional (só quem faz o serviço) → dia → horários livres → dados + consentimento (LGPD)
- [x] **Garantia de que dois clientes nunca pegam o mesmo horário**, mesmo agendando ao mesmo tempo
- [x] E-mail de confirmação e **lembrete 24h antes** (envio único, mesmo com várias instâncias)
- [x] Cancelamento pelo link do e-mail (abrir a página não cancela: só o clique)
- [x] **Agendar para outra pessoa:** se o mesmo e-mail já tem um horário no período, a página pergunta se é para outra pessoa e pede só o nome dela (sem revelar qual é o outro horário)

### Dono do negócio (painel)
- [x] Cadastro e login; o estabelecimento é criado junto (slug gerado do nome e fuso horário)
- [x] **Esqueci minha senha:** link por e-mail, válido por 1 hora e uma vez só; trocar a senha encerra as sessões abertas
- [x] Serviços (duração e preço), profissionais (quais serviços cada um faz) e horário semanal com intervalos (almoço)
- [x] **Agenda** em visão de dia e de semana, com resumo e mudança de status: concluído, falta e cancelado (o cliente é avisado)
- [x] **Bloqueios:** folgas, férias e feriados, de um profissional ou de todos, por dias ou por horas. Os horários somem da página pública, e o painel avisa sobre quem já tinha marcado
- [x] **Clientes:** busca por nome, e-mail ou telefone, com paginação; ficha com visitas, faltas, total gasto e histórico
- [x] **Relatórios:** receita, atendimentos, ticket médio e taxa de faltas por período, com comparação ao período anterior, gráfico por dia (com visão em tabela) e rankings por serviço e por profissional

### Próximos
Edição dos dados do estabelecimento, envio de e-mail em produção, planos Free/Pro. Detalhes no [roadmap](#roadmap).

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Front-end | React + TypeScript + Vite + React Router | Padrão de mercado, build rápido |
| Dados no front | TanStack Query | Cache, "carregando" e "erro" das chamadas à API sem código repetido |
| Estilização | TailwindCSS | Produtividade sem CSS solto |
| Back-end | Node.js 22 LTS + Express + TypeScript | Mesma linguagem no front e no back |
| Validação | Zod | Validação de entrada com tipos inferidos |
| Banco | PostgreSQL 16 + Prisma ORM | Relacional, com constraints fortes (ver ADR 0001) |
| Autenticação | JWT em cookie httpOnly + bcryptjs | Token fora do alcance de JavaScript (XSS); bcryptjs é o bcrypt em JS puro, sem compilação nativa no Windows/CI |
| E-mail | Nodemailer (SMTP) | Mailpit em dev; em produção, o envio fica desligado até configurar um provedor (ex.: Brevo) |
| Jobs | node-cron | Suficiente para o volume do MVP (ver [Decisões técnicas](#decisões-técnicas)) |
| Testes | Vitest + Supertest (API) e Vitest + Testing Library (front) | Integração da API contra um Postgres real; telas testadas como o usuário usa |
| Lint (front) | oxlint | Linter rápido, padrão do template do Vite |
| CI | GitHub Actions | Back: typecheck, testes (Postgres real) e build. Front: lint, typecheck, testes e build |
| Ambiente local | Docker Compose | Postgres e caixa de e-mail de teste com um comando |
| Deploy | Vercel (front) + Render (API) + Neon (Postgres) | Planos gratuitos; deploy automático a cada merge com CI verde |

## Estrutura do código

```
lembrai/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/       # peças visuais reaproveitadas
│   │   ├── features/         # uma pasta por fluxo: booking, agenda, customers, reports, time-offs...
│   │   ├── lib/              # cliente HTTP, formatação, hooks utilitários
│   │   └── pages/
│   ├── vercel.json           # rewrite /api -> Render e fallback da SPA
│   └── vite.config.ts        # proxy /api -> API local
│
├── backend/                  # Node.js + Express + TypeScript
│   ├── prisma/               # schema, migrations e seed da conta demo
│   ├── src/
│   │   ├── routes/ controllers/ services/   # HTTP -> regra de negócio
│   │   ├── domain/           # funções puras: horários livres, regras de status
│   │   ├── schemas/          # validação com Zod
│   │   ├── middlewares/      # login, rate limit, tratamento de erros
│   │   ├── jobs/             # lembretes (node-cron)
│   │   ├── emails/           # modelos de e-mail (com escape de HTML)
│   │   └── demo/             # gerador da conta demo
│   └── tests/
│
├── docs/
│   ├── adr/                  # registros de decisões técnicas
│   └── guia-de-estudo.md
├── .github/workflows/        # CI
├── render.yaml               # infraestrutura da API como código
└── docker-compose.yml        # Postgres + Mailpit locais
```

## Modelo de dados

```
User 1──N Establishment 1──N Professional N──N Service
                │                 ├──N WorkingHours
                │                 └──N TimeOff (bloqueio de um profissional)
                ├──N TimeOff (bloqueio do estabelecimento inteiro)
                ├──N Customer
                └──N Appointment (Customer, Professional, Service)
```

| Entidade | Campos principais | Observações |
|---|---|---|
| **User** | id, name, email (único), passwordHash | Dono do negócio |
| **Establishment** | id, name, slug (único), timezone, userId | `timezone` ex.: `America/Recife` |
| **Professional** | id, name, establishmentId, active | Desativado em vez de apagado (preserva o histórico) |
| **Service** | id, name, durationMinutes, priceCents, establishmentId, active | Preço em centavos (inteiro, sem erro de arredondamento) |
| **ProfessionalService** | professionalId, serviceId | N:N: nem todo profissional faz todo serviço |
| **WorkingHours** | id, professionalId, dayOfWeek (0–6), startTime, endTime | Várias linhas por dia permitem intervalo de almoço |
| **TimeOff** | id, establishmentId, professionalId (opcional), startAt, endAt, reason | Sem profissional = vale para todos (feriado) |
| **Customer** | id, name, email, phone, establishmentId | Único por (establishmentId, email) |
| **Appointment** | id, establishmentId, professionalId, serviceId, customerId, startAt, endAt, priceCentsAtBooking, status, cancelToken, reminderSentAt | Ver regras abaixo |

**Regras importantes:**
- `startAt` e `endAt` são gravados em **UTC** (`timestamptz`) ([ADR 0002](docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md)).
- `priceCentsAtBooking` guarda o preço **no momento do agendamento**. Se o dono mudar o preço depois, o histórico e os relatórios não mudam.
- `status`: `SCHEDULED | COMPLETED | CANCELED | NO_SHOW`, com transições controladas por uma máquina de estados.
- **Sem sobreposição:** o banco impede dois agendamentos não cancelados do mesmo profissional com horários que se cruzam ([ADR 0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md)).
- `reminderSentAt` torna o envio do lembrete **idempotente**.
- `cancelToken` é um valor aleatório de 256 bits, usado no link de cancelamento enviado ao cliente.

## Segurança e privacidade

- **Isolamento entre estabelecimentos (multi-tenant):** toda consulta do painel é filtrada pelo estabelecimento do usuário logado. Testes de integração garantem que o dono A recebe `404` ao tentar acessar recursos do dono B (IDOR).
- **Autenticação:** senha com bcrypt; JWT com expiração em cookie `httpOnly`, `Secure`, `SameSite=Lax`; resposta igual para e-mail inexistente e senha errada.
- **Recuperação de senha:** resposta igual exista a conta ou não; token aleatório guardado só como hash, com validade de 1 hora e uso único (garantido por `UPDATE` condicional); trocar a senha derruba as sessões antigas (versão de sessão dentro do JWT).
- **Rate limit** no login, no cadastro e nas rotas públicas, com `trust proxy` configurado para enxergar o IP real atrás da Vercel e do Render.
- **Cabeçalhos e CORS:** Helmet e CORS restrito ao domínio do front.
- **Validação:** toda entrada passa por um schema Zod antes de chegar à regra de negócio.
- **E-mails:** tudo que o cliente digita é escapado antes de entrar no HTML.
- **LGPD:** a página pública informa por que os dados (nome, e-mail, telefone) são coletados, pede consentimento e usa os dados só para o agendamento e o lembrete.

## Decisões técnicas

| # | Decisão | Resumo |
|---|---|---|
| [0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md) | Prevenção de conflito de agenda no banco | Exclusion constraint do Postgres em vez de checar no código |
| [0002](docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md) | Datas em UTC + timezone do estabelecimento | Evita horários errados em horário de verão e servidores em outro fuso |
| [0003](docs/adr/0003-deploy-com-proxy-na-vercel.md) | Deploy com a Vercel repassando `/api` para o Render | Front e API na mesma origem: cookie de login seguro sem CORS entre domínios |

Decisões menores, sem ADR próprio:
- **node-cron em vez de fila (BullMQ/pg-boss):** no volume do MVP, um job a cada 15 min basta. O `reminderSentAt` garante que reinícios ou execuções duplicadas não reenviem e-mails.
- **Bloqueio não cancela agendamentos existentes:** o painel avisa e o dono decide. Entre bloqueio e agendamento não há constraint no banco (são tabelas diferentes); a janela de corrida foi aceita e está documentada no guia.
- **Paginação por offset nos clientes:** simples e permite pular para qualquer página; para listas enormes, a troca seria por cursor.
- **Duas pastas em vez de monorepo:** front e back independentes simplificaram o primeiro deploy. A migração para workspaces está no roadmap técnico.

## Como rodar localmente

### Pré-requisitos
- Node.js 22+
- Docker (para o Postgres e a caixa de e-mail de teste)

### Banco e e-mail
```bash
docker compose up -d
```
Sobe o Postgres e o [Mailpit](https://mailpit.axllent.org/), uma caixa de e-mail falsa: todo e-mail que a API envia em desenvolvimento aparece em **http://localhost:8025**, e nada sai para a internet.

### Back-end
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed          # cria a conta demo
npm run dev
```

O `db:seed` cria a **Barbearia Demo** (login `demo@example.com` / `lembrai-demo`): 4 serviços, 3 profissionais com expediente, bloqueios de exemplo e cerca de 700 agendamentos de duas semanas antes a duas semanas depois de hoje, com todos os status. Pode rodar quantas vezes quiser, porque ele recria só a conta demo. Os clientes fictícios usam `@example.com` (domínio reservado) e já vêm com o lembrete marcado como enviado, então nenhum e-mail sai para eles.

Variáveis do `.env` (o `.env.example` já vem pronto para desenvolvimento):

| Variável | Exemplo |
|---|---|
| `DATABASE_URL` | `postgresql://lembrai:lembrai@localhost:5432/lembrai` |
| `JWT_SECRET` | string longa e aleatória |
| `FRONTEND_URL` | `http://localhost:5173` (usado também no link de cancelamento dos e-mails) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Mailpit em dev (`localhost:1025`); credenciais de um provedor SMTP em produção |
| `EMAIL_FROM` | `Lembrai <nao-responda@seudominio.com>` |
| `JOBS_ENABLED` | `true` liga o job de lembretes (a cada 15 min) |
| `TRUST_PROXY` | `0` em dev; `2` em produção (Vercel + Render) |

### Front-end
```bash
cd frontend
npm install
npm run dev
```
Abra http://localhost:5173/agenda/barbearia-demo (com a API rodando e o seed feito).

O front sempre chama `/api/...`, e em desenvolvimento o Vite repassa essas chamadas para a API em `localhost:3333` (veja `vite.config.ts`). Em produção, a Vercel faz o mesmo papel (`vercel.json`).

### Testes
```bash
cd backend && npm test
cd frontend && npm test
```

## Fluxo de trabalho

- **Uma branch e um Pull Request por funcionalidade**, com descrição do que mudou, por quê e como foi testado. Veja a aba [Pull requests](https://github.com/lucasbrilhante777/lembrai/pulls?q=is%3Apr+is%3Aclosed).
- **`main` protegida:** só entra código por PR, com o CI verde (lint, typecheck, testes e build do back e do front) e a branch atualizada.
- **Preview por PR:** a Vercel publica uma versão de cada PR para testar antes do merge.
- **Squash merge:** um commit por funcionalidade na `main`, com link para o PR.
- **Deploy contínuo:** cada merge com CI verde vai para produção (Vercel + Render, com as migrations aplicadas automaticamente).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`...).
- **Decisões:** toda decisão técnica relevante vira um ADR em `docs/adr/`, e cada etapa atualiza o [guia de estudo](docs/guia-de-estudo.md).

## Roadmap

**Produto**
- [x] Bloqueios de agenda (folgas, feriados, férias)
- [x] Histórico do cliente (agendamentos anteriores, faltas)
- [x] Relatório de faturamento por período
- [x] Recuperação de senha
- [ ] Verificação de e-mail no cadastro
- [ ] Edição dos dados do estabelecimento (nome, endereço da página, fuso)
- [ ] Envio de e-mail em produção (provedor SMTP)
- [ ] Planos Free (1 profissional, 100 agendamentos/mês) e Pro (ilimitado)
- [ ] Lembrete por WhatsApp
- [ ] Pagamento de sinal antecipado (Stripe ou Mercado Pago)
- [ ] Integração com Google Calendar

**Técnico**
- [ ] Migrar para monorepo (npm workspaces) com um pacote `shared/` contendo os schemas Zod usados pelo front e pelo back
- [ ] Testes E2E do fluxo de agendamento com Playwright
- [ ] Documentação da API com OpenAPI/Swagger

---

Feito por **Lucas Brilhante** · [GitHub](https://github.com/lucasbrilhante777) · [LinkedIn](https://www.linkedin.com/in/lucas-brilhante-0a0a24350/)
