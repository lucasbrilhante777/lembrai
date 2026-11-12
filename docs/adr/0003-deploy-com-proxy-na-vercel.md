# ADR 0003: Deploy com o front na Vercel repassando `/api` para a API no Render

- **Status:** Aceito
- **Data:** 2026-11-11

## Contexto

O Lembrai tem três partes para colocar no ar, num orçamento de portfólio (planos gratuitos):

| Parte | Onde | Por quê |
|---|---|---|
| Front-end (React, arquivos estáticos) | **Vercel** | Gratuito, publica a cada push, CDN |
| API (Node + Express) | **Render** | Plano gratuito para web services Node |
| Banco (PostgreSQL) | **Neon** | Postgres gerenciado gratuito, suporta a extensão `btree_gist` (ADR 0001) |

O problema: o login usa um **cookie `httpOnly` com `SameSite=Lax`** (ver guia de estudo, seção 6). Se o front estiver em `lembraiapp.vercel.app` e a API em `lembrai-api.onrender.com`, são **sites diferentes**, e o navegador não envia o cookie nas chamadas da API. Contornar isso exigiria `SameSite=None` e CORS com credenciais, o que deixa a proteção contra CSRF mais fraca e a configuração mais frágil.

## Decisão

1. **A Vercel repassa `/api/*` para o Render** (rewrite em `frontend/vercel.json`). O navegador só conversa com o domínio da Vercel. Para ele, front e API são o **mesmo site**, e o cookie continua `SameSite=Lax`. É o mesmo papel do proxy do Vite em desenvolvimento, então o código do front não muda entre os ambientes.
2. **`trust proxy` = 2** na API (`TRUST_PROXY`): entre o cliente e o Express existem dois proxies (Vercel e Render). Com isso, o Express lê o IP real do cliente no `X-Forwarded-For`. Sem isso, o **rate limit** veria todo mundo com o IP da Vercel, e 20 tentativas de login erradas de qualquer pessoa bloqueariam todas as outras.
3. **Infraestrutura como código:** a API é descrita em `render.yaml` (Blueprint). O build instala, compila, aplica as migrations (`prisma migrate deploy`) e recria a conta demo (o seed só toca na demo).
4. **Publicar só com CI verde:** `autoDeployTrigger: checksPass` no Render. Um commit que quebra os testes não vai para o ar.
5. **E-mail opcional:** sem `SMTP_HOST` em produção, o envio fica desligado (com aviso no log) e o resto funciona. Isso permite subir antes de configurar o Resend ou o Brevo.

## Consequências

**Positivas**
- Cookie seguro sem CORS entre domínios, e o mesmo código em dev e produção.
- Deploy reprodutível (está no Git) e protegido pelo CI.
- Custo zero.

**Negativas e como lidamos com elas**
- **O plano gratuito do Render "dorme"** depois de ~15 min sem acesso. A primeira requisição demora até ~1 minuto, e **enquanto dorme, o job de lembretes (node-cron) não roda**. Mitigação: um monitor externo gratuito (ex.: UptimeRobot ou cron-job.org) chama `GET /health` a cada 10 minutos, o que mantém a API acordada. Como o job é idempotente (ADR do guia, seção 11), um atraso só adia o lembrete, nunca o duplica.
- **O rewrite da Vercel aponta para uma URL fixa** do Render, escrita no `vercel.json`. Se o endereço da API mudar, é preciso atualizar esse arquivo.
- **A demo é recriada a cada deploy:** alterações feitas por visitantes somem, e os dados ficam "frescos" em relação à data do deploy. Depois de umas duas semanas sem deploy, a demo fica sem horários futuros (dá para resolver depois com um seed agendado).
- **Latência:** API (Virginia) e banco (us-east-1) ficam juntos; o usuário no Brasil paga uma ida aos EUA. Aceitável para um MVP.
