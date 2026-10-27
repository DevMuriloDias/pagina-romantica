# Amor em Página 💌

Aplicação web para criar **páginas românticas personalizadas**: o cliente responde um questionário, a IA gera o primeiro rascunho, ele edita tudo com prévia ao vivo, paga com **Pix ou cartão** (Mercado Pago) e recebe o link na tela e por e-mail.

> O nome do produto fica em `src/config.ts` (`BRAND.name`) — troque ali.

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Setup local passo a passo](#setup-local-passo-a-passo)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Pagamentos: Mercado Pago em sandbox (com ngrok)](#pagamentos-mercado-pago-em-sandbox-com-ngrok)
- [Armazenamento de fotos (R2/S3)](#armazenamento-de-fotos-r2s3)
- [E-mails (Resend)](#e-mails-resend)
- [IA (Anthropic)](#ia-anthropic)
- [Crons](#crons)
- [Testes](#testes)
- [Deploy](#deploy)
- [Admin](#admin)
- [Como adicionar um novo módulo](#como-adicionar-um-novo-módulo)

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS 4 + componentes no padrão shadcn/ui (Radix) · Framer Motion · PostgreSQL + Prisma · Zustand · dnd-kit · Zod · Mercado Pago (Checkout Transparente: Pix via API de Payments + Card Payment Brick) · Resend + React Email · Anthropic SDK · Leaflet/OpenStreetMap + Nominatim · S3/R2 com URL pré-assinada · Upstash Redis (rate limit) · Vitest + Playwright.

## Arquitetura

```
src/
  app/                       rotas (App Router)
    page.tsx                 landing
    criar/                   questionário → editor → revisão → checkout
    p/[slug]/                página pública (SSR) + OG image
    minhas-paginas/          acesso por magic link
    admin/                   painel (login próprio)
    api/                     drafts, pages, ai, uploads, checkout, orders (+SSE),
                             webhooks/mercadopago, public, qr, cron, geocode
  components/
    page/                    RENDERER ÚNICO da página (preview = página pública)
      sections/              16 módulos (hero, cartas, fotos, linha do tempo, mapa…)
    builder/                 editor (painéis, editores por módulo, tema, preview)
    checkout/                Pix, cartão, SSE, tela de sucesso
  lib/
    content/                 schema Zod versionado + migrações + textos padrão
    theme/                   design tokens, 8 templates, fontes, contraste WCAG
    sections/registry.ts     registro tipado dos módulos (sectionRegistry)
    payments/                provedor MP/mock, assinatura, fulfillment idempotente
    ai/                      prompts (pt-BR), schemas, retry de JSON, streaming
    pages/                   acesso (cookies/tokens), serviço, porta (bcrypt)
  emails/                    templates React Email
  stores/builder.ts          Zustand com histórico (desfazer/refazer)
prisma/                      schema, migrações e seed
tests/unit · tests/e2e       Vitest · Playwright
```

**Princípios**

- **Preview idêntico**: o editor e `/p/[slug]` usam o mesmo `PageRenderer`. O preview usa *container queries* (`@md:`) e `transform` para prender elementos fixos à moldura, então o layout é exatamente o mesmo.
- **Sem login para criar**: rascunho anônimo com token em cookie `httpOnly` (no banco só o hash SHA-256). O e-mail só é pedido no checkout.
- **Preço sempre no servidor**: planos/cupons vêm do banco e o valor é recalculado ao criar o pagamento.
- **Webhook nunca confia no payload**: valida `x-signature`, registra o evento e busca o pagamento na API pelo ID. O processamento é idempotente (transição atômica via `updateMany` condicional).

Decisões tomadas fora do documento original estão em [`DECISIONS.md`](./DECISIONS.md).

## Setup local passo a passo

Pré-requisitos: **Node 20+** (testado com 22), **PostgreSQL 14+**.

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#   - gere APP_SECRET: openssl rand -hex 32
#   - ajuste DATABASE_URL
#   - para testar pagamentos sem conta: PAYMENTS_PROVIDER=mock e MP_WEBHOOK_SECRET=qualquer-coisa

# 3. Banco
npx prisma migrate dev        # cria as tabelas
npm run db:seed               # planos (preços PLACEHOLDER), 8 templates, cupom BEMVINDO10, admin

# 4. Rodar
npm run dev                   # http://localhost:3000
```

Sem nenhuma chave externa o app já funciona de ponta a ponta:

| Serviço | Sem configuração |
|---|---|
| Pagamentos | `PAYMENTS_PROVIDER=mock`: Pix e cartão simulados; na tela do Pix aparece “Simular pagamento aprovado”, que dispara o **mesmo webhook assinado** do Mercado Pago |
| Fotos | `STORAGE_DRIVER=local`: arquivos em `./.uploads` |
| E-mails | sem `RESEND_API_KEY`: registrados na tabela `EmailLog` e no console (veja em `/admin/emails`) |
| IA | sem `ANTHROPIC_API_KEY`: textos padrão de boa qualidade (o fluxo nunca trava) |
| Rate limit | sem Upstash: limitador em memória |

Scripts: `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run build`.

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](./.env.example). O que você precisa providenciar para produção:

| Conta / configuração | Variáveis |
|---|---|
| Domínio + hospedagem (ex.: Vercel) | `APP_URL` |
| PostgreSQL (Neon, Supabase, RDS…) | `DATABASE_URL` |
| Mercado Pago (credenciais de produção + webhook) | `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `PAYMENTS_PROVIDER=mercadopago` |
| Cloudflare R2 ou AWS S3 (bucket público ou com CDN) | `STORAGE_DRIVER=s3`, `S3_*` |
| Resend (domínio verificado) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| Anthropic | `ANTHROPIC_API_KEY`, `AI_MODEL` (padrão `claude-sonnet-5-5`) |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Segredos internos | `APP_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

## Pagamentos: Mercado Pago em sandbox (com ngrok)

1. Crie uma aplicação em **Mercado Pago Developers → Suas integrações** (produto “Pagamentos online / Checkout Transparente”).
2. Em **Credenciais de teste**, copie o *Access Token* e a *Public Key*:
   ```env
   PAYMENTS_PROVIDER=mercadopago
   MP_ACCESS_TOKEN=TEST-...           # ou APP_USR-... de uma conta de teste
   NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-...
   ```
3. Exponha o app local com o **ngrok** (o MP só envia webhooks para URL https pública):
   ```bash
   npm run dev
   ngrok http 3000
   # copie a URL https://xxxx.ngrok-free.app
   ```
   Coloque essa URL em `APP_URL` (o app envia `notification_url` = `APP_URL/api/webhooks/mercadopago` em cada pagamento) e reinicie o `npm run dev`.
4. Em **Suas integrações → Webhooks → Modo de teste**: URL `https://xxxx.ngrok-free.app/api/webhooks/mercadopago`, evento **Pagamentos**. Copie a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
5. Teste com **cartões de teste** (Mercado Pago → Cartões de teste), por exemplo Mastercard `5031 4332 1540 6351`, CVV `123`, validade `11/30`. O **nome do titular** define o resultado: `APRO` aprovado, `OTHE` recusado, `CONT` pendente, `FUND` saldo insuficiente, `SECU` CVV inválido. CPF de teste: `12345678909`.
6. **Pix em sandbox**: o QR Code é gerado de verdade, mas não dá para pagá-lo com um banco real. Para aprovar, use o botão “Simular notificação” do painel de Webhooks ou rode o app com `PAYMENTS_PROVIDER=mock` — o simulador percorre exatamente o mesmo caminho (webhook com `x-signature` → busca do pagamento → liberação). Se um webhook se perder, o cron de reconciliação e a própria tela de pagamento (consulta direta a cada 15 s) atualizam o pedido.
7. Acompanhe tudo em `/admin/webhooks` (assinatura válida/inválida, resultado de cada evento).

Em produção, troque para as credenciais de produção e cadastre o webhook no modo produção.

## Armazenamento de fotos (R2/S3)

As fotos são comprimidas e convertidas para WebP **no navegador**, enviadas **direto ao bucket** via *presigned POST* (com limite de tamanho e tipo) e, em seguida, o servidor baixa o arquivo, valida o conteúdo real com `sharp`, **remove EXIF/GPS**, gera o WebP final e apaga o original.

Cloudflare R2:
1. Crie o bucket e um *API token* com permissão de leitura/escrita → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
2. Habilite acesso público (domínio próprio ou `r2.dev`) → `S3_PUBLIC_URL`.
3. Configure o **CORS** do bucket (necessário para o upload direto, o recorte e a extração de paleta):
   ```json
   [{ "AllowedOrigins": ["https://seudominio.com.br", "http://localhost:3000"], "AllowedMethods": ["GET", "POST", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```

## E-mails (Resend)

Verifique o domínio no Resend, defina `RESEND_API_KEY` e `EMAIL_FROM`. Todo envio é registrado em `EmailLog`; falhas são retentadas na hora (3x com backoff) e depois pelo cron `/api/cron/emails`. Os templates ficam em `src/emails/templates.tsx`.

E-mails: pagamento aprovado (link, QR Code, link mágico de edição e dicas), continuar rascunho, acesso a “Minhas páginas”, página aberta, resposta do pedido, vale resgatado, recado recebido e Pix gerado.

## IA (Anthropic)

- Chave só no servidor (`/api/ai/*`, `/api/pages/[id]/generate`). Modelo em `AI_MODEL` (padrão `claude-sonnet-5-5`).
- Prompts em português em `src/lib/ai/prompts/`. Saídas JSON validadas com Zod e **uma nova tentativa automática** informando o erro ao modelo.
- Cartas e “melhorar texto” usam **streaming**.
- Limites: `AI_MAX_PER_DRAFT` (contador no banco) e `AI_MAX_PER_IP` (24 h). Moderação básica antes da chamada + regras no prompt de sistema.
- `AI_SERVER_FALLBACK=1` habilita o *fallback* de modelo do lado do servidor (beta `server-side-fallback-2026-07-01`) para recusas de classificador. Desligue com `0` se preferir.

## Crons

Rotas protegidas por `Authorization: Bearer $CRON_SECRET` (padrão da Vercel Cron, já configurado em `vercel.json`). O plano Hobby da Vercel só permite crons diários; no plano Pro, use `*/10 * * * *` (reconcile) e `*/15 * * * *` (emails). Mesmo com cron diário, a tela de pagamento consulta o Mercado Pago a cada 15 s enquanto o cliente está nela, e os e-mails já têm 3 tentativas imediatas.

| Rota | Frequência | O que faz |
|---|---|---|
| `/api/cron/reconcile` | diário (10 min no plano Pro) | consulta na API os pedidos pendentes (webhook perdido) e expira Pix vencidos |
| `/api/cron/emails` | diário (15 min no plano Pro) | reenvia e-mails que falharam |
| `/api/cron/cleanup` | diário | apaga rascunhos não pagos e suas fotos após `DRAFT_RETENTION_DAYS` (30) e uploads abandonados |

Fora da Vercel, agende com qualquer cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://seudominio/api/cron/reconcile`.

## Testes

```bash
npm test               # Vitest: schemas, migrações, planos/cupons, assinatura do webhook, status,
                       # normalização da porta, música, tempo, céu, moderação, store (desfazer/refazer)
npm run build && npm run test:e2e
```

O E2E (Playwright, celular e desktop) percorre: **questionário → editar (autosave) → revisão → checkout → Pix → aprovação via webhook assinado → link liberado na tela (SSE) → e-mail registrado → página pública abre**. Requer Postgres com as migrações e o seed aplicados; sobe o servidor com `PAYMENTS_PROVIDER=mock`.

Se o Playwright não encontrar o navegador, aponte para um Chromium instalado: `PW_CHROMIUM_PATH=/caminho/do/chrome npm run test:e2e`.

## Deploy

Vercel (recomendado):
1. Importe o repositório, configure as variáveis de ambiente de produção.
2. Build command padrão (`next build`). Rode as migrações no deploy: `npx prisma migrate deploy` (ex.: no *build command* `prisma migrate deploy && next build`).
3. Rode o seed uma vez (`npm run db:seed`) e **defina os preços reais** em `/admin/planos`.
4. Cadastre o webhook do Mercado Pago em produção apontando para `https://seudominio/api/webhooks/mercadopago`.
5. Os crons de `vercel.json` passam a rodar automaticamente (defina `CRON_SECRET`).

Headers de segurança e CSP (compatível com YouTube, Spotify, Mercado Pago, Google Fonts e tiles do OSM) estão em `next.config.ts`.

## Admin

`/admin` — login com `ADMIN_EMAIL`/`ADMIN_PASSWORD` criados pelo seed (troque a senha!). Dashboard (vendas do dia/mês, conversão, ticket médio), pedidos (filtros, reenviar e-mail, reembolsar via API), páginas (busca, denúncias, despublicar, excluir), planos/preços, cupons, templates (ativar/ordenar), webhooks e e-mails.

## Como adicionar um novo módulo

1. Schema dos dados em `SECTION_DATA` e variante em `SectionSchema` (`src/lib/content/schema.ts`). Se mudar algo já existente, incremente `CONTENT_SCHEMA_VERSION` e crie a migração em `migrations.ts`.
2. Metadados e padrões em `src/lib/sections/registry.ts`.
3. Renderer em `src/components/page/sections/` + registro em `renderers.tsx`.
4. Editor em `src/components/builder/editors/` + registro em `editors/index.tsx`.

O TypeScript acusa erro se algum dos mapas ficar incompleto.
