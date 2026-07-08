# Vertical Vision

App mobile-first, gamificado, de desenvolvimento pessoal. Cada área da vida (treino,
cozinha, quarto, mental, casa, inclusão) vira uma "área" de um mapa, com missões, hábitos,
cristais (moeda), conquistas, rituais e assistentes de IA (Orientador, IA-Coletora,
Companheiras do Sono e do Despertar). Inclui camada social, notificações + Web Push,
acompanhamento orientador↔aluno, wearables, assinatura via Stripe e um **servidor MCP
próprio** exposto pelo app.

- **Repositório:** `nhnoneweme-debug/mobile-vision-vertical-joy`
- **Sincroniza com o Lovable** pela branch `main` (não reescrever histórico — sem force-push/rebase).
- **App publicado:** https://mobile-vision-vertical-joy.lovable.app
- **Documentação de rotas:** [`openapi.json`](./openapi.json) (swagger de todas as rotas).
- **Arquitetura detalhada:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — descrição por arquivo, mapa de dependências (quem depende de quem), fluxos de interação e catálogo de rotas com diagramas.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start + TanStack Router (rotas por arquivo, SSR seletivo) |
| Runtime | `src/server.ts`, `src/start.ts`; Vite (`vite.config.ts`); Bun (`bunfig.toml`, `bun.lock`) |
| UI | React + shadcn/ui + Radix + Tailwind; toasts `sonner` |
| Backend | Supabase (Auth, Postgres + RLS, Storage) — 56 migrations em `supabase/migrations` |
| IA | Lovable AI Gateway via Vercel AI SDK (`streamText`); tools tipadas com Zod |
| Pagamentos | Stripe Embedded Checkout (`src/utils/payments.functions.ts`, `lib/stripe*`) |
| PWA / Push | `public/manifest.webmanifest`, `public/push-sw.js`, `lib/push*` |
| MCP | Servidor `personal-ia-mcp` (`@lovable.dev/mcp-js`) exposto em `/mcp` com OAuth Supabase |

## Arquitetura

```
src/
  routes/                      # roteamento por arquivo (TanStack Router)
    __root.tsx                 # shell raiz, providers (React Query), 404, tema, PWA
    index.tsx / auth.tsx / checkout.return.tsx / sitemap[.]xml.ts   # públicas
    [.]lovable.oauth.consent.tsx           # tela de consentimento OAuth (MCP)
    [.mcp]/list-tools.ts, [.mcp]/invoke-tool/$tool.ts   # MCP (auto-gerado)
    [.well-known]/oauth-protected-resource.ts           # descoberta OAuth
    mcp.ts                     # endpoint MCP /mcp (auto-gerado)
    _authenticated/
      route.tsx                # beforeLoad: getUser() -> redirect /auth + gate de onboarding
      *.tsx                    # páginas do app autenticado
    api/
      chat.ts, ia-capture.ts, sleep-chat.ts, wake-chat.ts   # POST autenticados (Bearer JWT)
      public/hooks/generate-nudges.ts, push-notification.ts # POST webhooks (apikey)
  components/                  # ui/ (shadcn), area/, map/, social/, onboarding/, orientador/, shell/, pwa/...
  lib/                         # domínio: habits, missions, quests, score, crystals, shop, social,
                               #   notifications, push*, mental, orientador-chat, wearables, stripe*, ai-gateway.server
    mcp/                       # servidor MCP: index.ts + tools/ (get-profile, list-*, generate-nudges)
  integrations/supabase/       # client(.server), auth-middleware, auth-attacher, types
  providers/ViewportProvider   # guarda de viewport (mobile-first)
  routeTree.gen.ts             # árvore de rotas gerada
supabase/migrations/           # 56 migrations SQL (schema + RLS)
```

### Autenticação (4 esquemas)

1. **Páginas** — layout-route `_authenticated/route.tsx`: `beforeLoad` chama
   `supabase.auth.getUser()`; sem sessão → `redirect('/auth')`; gate de onboarding
   (`profiles.onboarding_completed`).
2. **API de IA** (`/api/chat|ia-capture|sleep-chat|wake-chat`) — `Authorization: Bearer
   <JWT Supabase>`, validado por `getClaims`; `401` se ausente/ inválido.
3. **Webhooks** (`/api/public/hooks/*`) — header `apikey`/`x-api-key` = chave anon/publishable;
   internamente usam **service_role**. Pensados para pg_cron / Edge Functions.
4. **MCP** (`/mcp`) — **OAuth 2.0 via Supabase** (audience `authenticated`); descoberta em
   `/.well-known/oauth-protected-resource`, consentimento em `/.lovable/oauth/consent`.

## Rotas registradas

### Páginas públicas (5)
`/` · `/auth` · `/checkout/return` · `/sitemap.xml` · `/.lovable/oauth/consent`

### Páginas autenticadas (31 — `_authenticated`)
`/alarme` · `/area/$slug` · `/area/orientador` · `/calendario` · `/classe` · `/conquistas` ·
`/cristais` · `/desafios` · `/despertar` · `/dormir` · `/habitos` · `/ia` · `/jornada` ·
`/loja` · `/mapa` · `/mental` · `/missoes` · `/notificacoes` · `/onboarding` ·
`/orientador-chat` · `/painel` · `/painel-aluno/$id` · `/perfil` · `/planos` ·
`/preferencias-notificacoes` · `/progresso` · `/ritual` · `/social` · `/sonhos` · `/studio` ·
`/wearables`

### Endpoints de API (6)
| Método | Rota | Auth |
|---|---|---|
| POST | `/api/chat` | Bearer JWT |
| POST | `/api/ia-capture` | Bearer JWT |
| POST | `/api/wake-chat` | Bearer JWT |
| POST | `/api/sleep-chat` | Bearer JWT |
| POST | `/api/public/hooks/generate-nudges` | apikey (webhook) |
| POST | `/api/public/hooks/push-notification` | apikey (webhook) |

### Servidor MCP (4)
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/mcp` | OAuth Supabase | Endpoint MCP (JSON-RPC) do `personal-ia-mcp` |
| GET | `/.mcp/list-tools` | OAuth Supabase | Lista as tools |
| POST | `/.mcp/invoke-tool/$tool` | OAuth Supabase | Invoca uma tool por nome |
| GET | `/.well-known/oauth-protected-resource` | Público | Metadados de descoberta OAuth |

**Tools MCP:** `get_profile`, `list_missions`, `list_habits`, `list_notifications`
(read-only) e `generate_nudges` (escrita, idempotente).

**Total: 46 rotas** (5 públicas + 31 autenticadas + 6 API + 4 MCP), em paridade 1:1 com
`src/routeTree.gen.ts`.

## Banco de dados

Núcleo: `profiles`, hábitos/missões/quests, cristais/loja (`has_active_perk`,
`purchase_shop_item`), conquistas, social (feed, grupos, bloqueios). Camadas recentes:
`notifications` (+ fila/trigger de push via `pg_net`, `notify_push_on_insert`),
`push_subscriptions`, `generate_nudges_for`/`generate_nudges_all_users`,
`orientador_messages` + `orientador_student_snapshot`, `belief_confrontations` (mental),
`wearable_samples`/`wearable_connections` + `import_wearable_samples`. RLS por usuário nas
tabelas de dados pessoais.

## Rodando localmente

```bash
npm install        # ou: bun install
npm run dev        # vite dev -> http://localhost:3000
npm run build      # vite build
npm run lint
```

Variáveis (`.env`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
(+ variantes `VITE_`), `VITE_PAYMENTS_CLIENT_TOKEN` (Stripe). Apenas para servidor:
`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, chaves VAPID (Web Push).

## Fluxo de trabalho (Git ↔ Lovable)

`main` (↔ Lovable) → `develop` (features) → `test` (testes). Desenvolve-se em `develop`/`test`;
merge para `main` + `git push` faz o Lovable puxar automaticamente. **Nunca** force-push/rebase
de histórico já enviado (quebra o histórico no Lovable — ver `AGENTS.md`).

> Contexto vivo do projeto e log de ações ficam em `weme/_contexto-lovable/`
> (`context.md`, `logs.md`).
