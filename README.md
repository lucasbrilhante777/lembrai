# Lembrai

[![CI](https://github.com/lucasbrilhante777/lembrai/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasbrilhante777/lembrai/actions/workflows/ci.yml)

> 🚧 **Em desenvolvimento.** A API do MVP está completa e testada: autenticação, serviços, profissionais e horários, cálculo de horários livres com fuso horário, agendamento público com garantia anti-conflito, e-mails de confirmação e lembrete, cancelamento pelo link e agenda do dono. Já tem conta demo com dados realistas. No front-end, a página pública de agendamento, o login, a agenda do dono e a página de cancelamento estão prontos. Próximos passos: telas de serviços, profissionais e horários, e o deploy. Acompanhe pela [lista de funcionalidades](#funcionalidades).

**Agendamento online + lembretes automáticos para pequenos negócios de serviço** (barbearias, salões, clínicas, personal trainers).

O cliente agenda sozinho por um link público, sem criar conta. O dono vê a agenda num calendário e não precisa mais lembrar ninguém pelo WhatsApp: o sistema manda o lembrete.

> 🔗 **Demo:** TODO (link do deploy)
> 👤 **Conta demo:** `demo@example.com` / `lembrai-demo`
> 📅 **Página pública de exemplo:** TODO (`/agenda/barbearia-demo`)
> 📚 **[Guia de estudo](docs/guia-de-estudo.md):** os conceitos por trás do projeto (concorrência, fuso horário, segurança, testes, CI) e como cada um aparece no código

![Fluxo de agendamento](docs/img/demo.gif) <!-- TODO: gravar o GIF do fluxo principal -->

---

## Sumário
- [O problema](#o-problema)
- [Personas](#personas)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
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

O Lembrai resolve com:

- uma **página pública de agendamento** (`/agenda/:slug`) que mostra só os horários realmente livres;
- um **calendário** para o dono acompanhar o dia e a semana;
- **lembrete automático por e-mail** 24h antes, com link para o cliente cancelar se não puder ir.

> **Por que e-mail e não WhatsApp?** No MVP, e-mail é gratuito e não depende de aprovação de API. O telefone do cliente já é coletado desde o primeiro agendamento, então a migração para WhatsApp (no [roadmap](#roadmap)) não exige mudança no modelo de dados.

## Personas

| Persona | O que precisa | Como usa o Lembrai |
|---|---|---|
| **Dono do negócio** | Menos faltas, agenda organizada, menos tempo no WhatsApp | Configura serviços, profissionais e horários; acompanha o calendário |
| **Cliente final** | Agendar rápido, sem cadastro | Escolhe serviço, profissional e horário na página pública |

O **profissional** (ex.: o barbeiro funcionário) existe no sistema para ter agenda própria, mas **não tem login no MVP**: quem gerencia tudo é o dono.

## Funcionalidades

### MVP (v1)
- [x] Cadastro e login do dono (o estabelecimento é criado junto, com slug gerado a partir do nome)
- [ ] Cadastro do estabelecimento (nome, slug, fuso horário)
- [x] Serviços (nome, duração, preço)
- [x] Profissionais e quais serviços cada um realiza
- [x] Horário semanal de trabalho por profissional
- [x] Cálculo de horários livres (respeitando duração do serviço, expediente e agendamentos existentes)
- [x] Página pública `/agenda/:slug`, sem o cliente criar conta
- [x] **Garantia de que dois clientes nunca pegam o mesmo horário**, mesmo agendando ao mesmo tempo ([ADR 0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md))
- [x] Calendário do dono (visão diária e semanal) com mudança de status: concluído, falta, cancelado
- [x] E-mail de confirmação ao agendar e lembrete por e-mail 24h antes (envio único, mesmo com várias instâncias)
- [x] Cancelamento pelo cliente através do link no e-mail

### v1.1+
Bloqueios e folgas, histórico do cliente, relatório de faturamento, recuperação de senha, planos Free/Pro. Detalhes no [roadmap](#roadmap).

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
| E-mail | Nodemailer via SMTP do Resend/Brevo | Planos gratuitos com boa entregabilidade (Gmail cai no spam) |
| Jobs | node-cron | Suficiente para o volume do MVP (ver [Decisões técnicas](#decisões-técnicas)) |
| Testes | Vitest + Supertest (API) e Vitest + Testing Library (front) | Integração da API contra um Postgres real; telas testadas como o usuário usa |
| Lint (front) | oxlint | Linter rápido, padrão do template do Vite |
| CI | GitHub Actions | Back: typecheck, testes (Postgres real) e build. Front: lint, typecheck, testes e build |
| Ambiente local | Docker Compose | Postgres com um comando |
| Deploy | Vercel (front) + Render ou Railway (API) + Neon (Postgres) | Planos gratuitos ou baratos; o Railway não tem mais free tier permanente |

## Arquitetura

```
lembrai/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/       # peças visuais reaproveitadas
│   │   ├── features/         # uma pasta por fluxo (ex.: booking = agendamento público)
│   │   ├── lib/              # cliente HTTP e formatação
│   │   └── pages/
│   ├── vite.config.ts        # proxy /api -> API local
│   └── package.json
│
├── backend/                  # Node.js + Express + TypeScript
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts           # dados da conta demo
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/         # regras de negócio (disponibilidade, agendamento)
│   │   ├── middlewares/      # auth, rate limit, tratamento de erros
│   │   ├── schemas/          # schemas Zod
│   │   └── jobs/             # cron de lembretes
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── docs/
│   └── adr/                  # registros de decisões técnicas
├── .github/workflows/        # CI
└── docker-compose.yml        # Postgres local
```

O front consome a API REST do back. As rotas do painel exigem o JWT (lido do cookie). As rotas públicas (`/public/:slug/...`) não exigem login e têm rate limit. Um job agendado roda a cada 15 minutos, busca os agendamentos das próximas 24h que ainda não receberam lembrete e envia os e-mails.

## Modelo de dados

```
User 1──N Establishment 1──N Professional N──N Service
                │                 │
                │                 └──N WorkingHours
                ├──N Customer
                └──N Appointment (Customer, Professional, Service)
```

| Entidade | Campos principais | Observações |
|---|---|---|
| **User** | id, name, email (único), passwordHash | Dono do negócio |
| **Establishment** | id, name, slug (único), timezone, userId | `timezone` ex.: `America/Recife` |
| **Professional** | id, name, establishmentId, active | Sem login no MVP |
| **Service** | id, name, durationMinutes, priceCents, establishmentId, active | Preço em centavos (inteiro, sem erro de arredondamento) |
| **ProfessionalService** | professionalId, serviceId | N:N: nem todo profissional faz todo serviço |
| **WorkingHours** | id, professionalId, dayOfWeek (0–6), startTime, endTime | Várias linhas por dia permitem intervalo de almoço |
| **Customer** | id, name, email, phone, establishmentId | Único por (establishmentId, email). Base do histórico na v1.1 |
| **Appointment** | id, establishmentId, professionalId, serviceId, customerId, startAt, endAt, priceCentsAtBooking, status, cancelToken, reminderSentAt, createdAt | Ver regras abaixo |

**Regras importantes:**
- `startAt` e `endAt` são gravados em **UTC** (`timestamptz`) ([ADR 0002](docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md)).
- `priceCentsAtBooking` guarda o preço **no momento do agendamento**. Se o dono mudar o preço depois, o histórico não muda.
- `status`: `SCHEDULED | COMPLETED | CANCELED | NO_SHOW`.
- **Sem sobreposição:** o banco impede dois agendamentos não cancelados do mesmo profissional com horários que se cruzam ([ADR 0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md)).
- `reminderSentAt` torna o envio do lembrete **idempotente**: se o job rodar duas vezes, o e-mail não duplica.
- `cancelToken` é um valor aleatório e longo, usado no link de cancelamento enviado ao cliente.

## Segurança e privacidade

- **Isolamento entre estabelecimentos (multi-tenant):** toda consulta do painel é filtrada pelo estabelecimento do usuário logado. Há testes de integração garantindo que o dono A recebe `404` ao tentar acessar recursos do dono B (proteção contra IDOR).
- **Autenticação:** senha com bcrypt; JWT com expiração curta em cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- **Rotas públicas:** rate limit por IP para evitar que um bot lote a agenda.
- **Cabeçalhos e CORS:** Helmet e CORS restrito ao domínio do front.
- **Validação:** toda entrada passa por um schema Zod antes de chegar à regra de negócio.
- **LGPD:** a página pública informa por que os dados (nome, e-mail, telefone) são coletados, pede consentimento e usa os dados só para o agendamento e o lembrete. O cliente pode pedir a exclusão ao estabelecimento.

## Decisões técnicas

| # | Decisão | Resumo |
|---|---|---|
| [0001](docs/adr/0001-prevencao-de-conflito-de-agenda.md) | Prevenção de conflito de agenda no banco | Exclusion constraint do Postgres em vez de checar no código |
| [0002](docs/adr/0002-datas-em-utc-e-timezone-do-estabelecimento.md) | Datas em UTC + timezone do estabelecimento | Evita horários errados em horário de verão e servidores em outro fuso |

Decisões menores, sem ADR próprio:
- **node-cron em vez de fila (BullMQ/pg-boss):** no volume do MVP, um job a cada 15 min basta. O `reminderSentAt` garante que reinícios ou execuções duplicadas não reenviem e-mails. Se houver várias instâncias da API, a migração natural é para o `pg-boss`.
- **Duas pastas em vez de monorepo:** front e back começam independentes para simplificar o primeiro deploy. A migração para workspaces está no roadmap técnico.

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

O `db:seed` cria a **Barbearia Demo** (login `demo@example.com` / `lembrai-demo`): 4 serviços, 3 profissionais com expediente e cerca de 700 agendamentos de duas semanas antes a duas semanas depois de hoje, com todos os status. Pode rodar quantas vezes quiser, porque ele recria só a conta demo. Os clientes fictícios usam `@example.com` (domínio reservado) e já vêm com o lembrete marcado como enviado, então nenhum e-mail sai para eles.

Variáveis do `.env` (o `.env.example` já vem pronto para desenvolvimento):

| Variável | Exemplo |
|---|---|
| `DATABASE_URL` | `postgresql://lembrai:lembrai@localhost:5432/lembrai` |
| `JWT_SECRET` | string longa e aleatória |
| `FRONTEND_URL` | `http://localhost:5173` (usado também no link de cancelamento dos e-mails) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Mailpit em dev (`localhost:1025`); credenciais do Resend/Brevo em produção |
| `EMAIL_FROM` | `Lembrai <nao-responda@seudominio.com>` |
| `JOBS_ENABLED` | `true` liga o job de lembretes (a cada 15 min) |

### Front-end
```bash
cd frontend
npm install
npm run dev
```
Abra http://localhost:5173/agenda/barbearia-demo (com a API rodando e o seed feito).

O front sempre chama `/api/...`, e em desenvolvimento o Vite repassa essas chamadas para a API em `localhost:3333` (veja `vite.config.ts`). Assim, front e API ficam na mesma origem e o cookie de login funciona sem CORS para outro domínio. Em produção, a Vercel faz o mesmo papel.

### Testes
```bash
cd backend && npm test
cd frontend && npm test
```

## Fluxo de trabalho

Projeto desenvolvido sozinho, em sprints semanais.

- **Board:** GitHub Projects (TODO: link), uma issue por funcionalidade com critérios de aceite.
- **Branches:** `feature/<nome>` e `fix/<nome>`, com merge na `main` só via Pull Request.
- **Pull Requests:** checklist (testes, migration, README atualizado). O CI (typecheck + testes + build) precisa passar para liberar o merge.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`...).
- **Decisões:** toda decisão técnica relevante vira um ADR em `docs/adr/`.

## Roadmap

**Produto**
- [ ] Bloqueios de agenda (folgas, feriados, férias)
- [ ] Histórico do cliente (agendamentos anteriores, faltas)
- [ ] Relatório de faturamento por período (soma dos agendamentos `COMPLETED` pelo preço salvo no agendamento)
- [ ] Recuperação de senha e verificação de e-mail
- [ ] Planos Free (1 profissional, 100 agendamentos/mês) e Pro (ilimitado)
- [ ] Lembrete por WhatsApp
- [ ] Pagamento de sinal antecipado (Stripe ou Mercado Pago)
- [ ] Integração com Google Calendar
- [ ] Múltiplas unidades por estabelecimento
- [ ] App mobile (React Native)

**Técnico**
- [ ] Migrar para monorepo (npm workspaces) com um pacote `shared/` contendo os schemas Zod usados pelo front e pelo back: um contrato único da API, validado nos dois lados. Vai virar um ADR.
- [ ] Testes E2E do fluxo de agendamento com Playwright
- [ ] Documentação da API com OpenAPI/Swagger

---

Feito por **Lucas Brilhante**: TODO (LinkedIn) · TODO (GitHub)
