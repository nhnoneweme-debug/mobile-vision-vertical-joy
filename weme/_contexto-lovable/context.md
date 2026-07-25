# Contexto vivo — Vertical Vision (mobile-vision-vertical-joy)

> Última atualização: 2026-07-15. Este arquivo é o ponto de entrada rápido do projeto:
> o que ele é, o que faz, como é organizado e onde cada coisa vive. Detalhe fino continua
> nos docs específicos (linkados abaixo) — aqui é o resumo que não fica desatualizado
> "por partes": ao mexer em algo grande, atualize a seção correspondente.
>
> Log de decisões/ações dia-a-dia: `logs.md` neste mesmo diretório (criar conforme uso).

## O que é

App mobile-first, gamificado, de desenvolvimento pessoal (nome interno "Personal IA" /
"Vertical Vision"). Cada área da vida (treino, cozinha, quarto, mental, casa, inclusão) é uma
"área" num mapa/hub, com missões, hábitos, cristais (moeda), conquistas, rituais e uma
Inteligência Digital (assistente conversacional) que propõe treino, dieta, hábitos e
compromissos — sempre sob confirmação do usuário. Tem camada social (grupos, feed, desafios
estilo GymRats), acompanhamento orientador↔aluno, wearables, diário alimentar (foto/código de
barras/manual), notificações + Web Push, assinatura via Stripe, e um **servidor MCP próprio**
que expõe o app como ferramenta para agentes externos (ex.: Claude).

- **Repo:** `nhnoneweme-debug/mobile-vision-vertical-joy` · sincroniza com o **Lovable** pela
  branch `main` (nunca force-push/rebase de histórico já enviado — ver `AGENTS.md`).
- **Publicado:** https://mobile-vision-vertical-joy.lovable.app
- **Fluxo git:** `develop` (features) → `test` → merge em `main` (auto-sync com Lovable).
- **Local:** `/home/glwydson/mobile-vision-vertical-joy`, branch principal de trabalho `develop`.

## Docs de referência (não duplicar aqui, só apontar)

| Doc | Conteúdo |
|---|---|
| `README.md` | Visão geral, stack, rodar localmente |
| `ARCHITECTURE.md` | Arquitetura por arquivo, diagramas Mermaid, mapa de dependências — **parcialmente desatualizado** (ver "Divergências" abaixo) |
| `openapi.json` | Contrato swagger das rotas de API |
| `MODELO_REGULAMENTACAO_IA.md` | Guardrails da IA: o que ela lê/escreve, fluxo proposta→confirmação→auditoria |
| `MOCKING.md` | Rodar offline com `npm run dev:mock` (dados fake, sem Supabase) |
| `DESIGN_PLAN.md` | Redesign "Forja" (charcoal & ember) em andamento — `/home` é o piloto |
| `src/_legacy/README.md` | Telas antigas preservadas (ex.: `MapaLegacy.tsx`) só como referência |
| `AGENTS.md` | Regra de ouro: não reescrever histórico git publicado (quebra sync com Lovable) |

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start + TanStack Router (rotas por arquivo, `src/routes/`) |
| Runtime | Vite 8, Bun/npm, `src/server.ts` + `src/start.ts` |
| UI | React 19 + shadcn/ui + Radix + Tailwind v4; `sonner` (toasts) |
| Backend | Supabase (Auth, Postgres + RLS, Storage) — **71 migrations** em `supabase/migrations/` |
| IA | AI SDK (`ai`, `@ai-sdk/*`) — provider OpenAI (`OPENAI_API_KEY`) com fallback no Lovable AI Gateway (`src/lib/ai-gateway.server.ts`) |
| Pagamentos | Stripe Embedded Checkout (`src/lib/stripe*.ts`, `src/utils/payments.functions.ts`) |
| PWA / Push | `public/manifest.webmanifest`, `public/push-sw.js`, `src/lib/push*.ts` (VAPID) |
| MCP | Servidor `personal-ia-mcp` (`@lovable.dev/mcp-js`) em `/mcp`, OAuth via Supabase |

## Funcionalidades (visão por área)

- **Gamificação:** classe/comportamento (`behavior.ts`), níveis/XP/rank (`level-tracks.ts`),
  perks (`perks.ts`), conquistas (`achievements.ts`), cristais/loja (`crystals.ts`, `shop.ts`),
  score semanal (`score.ts`), quest do dia (`quest.ts`/`quests.ts`).
- **Hábitos e missões:** CRUD, toggle diário, agenda (`habits.ts`, `missions.ts`,
  `area-missions.ts`), planejamento estratégico e calendário (`planning.ts`), rota `/agenda`
  (nova, ao lado de `/calendario`).
- **Treino:** módulo dedicado — planos, sessões, progresso, histórico
  (`treino.functions.ts`, `workouts.functions.ts`, rota `/treino` + `/treino/historico/$sessionId`,
  tabelas `workout_plans/sessions/progress`).
- **Diário alimentar / Cozinha:** plano de dieta via IA (`cozinha.ts`/`.functions.ts`) +
  diário alimentar real com **foto, código de barras e entrada manual**
  (`food-log.functions.ts`, tabela `food_log_entries`, rota `/plano-alimentar`, ~900 linhas —
  tela redesenhada mais recentemente).
- **Inteligência Digital (assistente conversacional):** evoluiu de chats fixos por área para
  um **agente único com tool-calling** que só *propõe* (nunca grava direto): hábito,
  compromisso, treino, dieta — usuário confirma no app (`api/assistant.ts`, `assistant.functions.ts`,
  `assistant-intent.ts`, rota `/assistente` e `/conversar`). Guardrails centralizados em
  `ai-guardrails.server.ts` (cláusula de crise, rate limit, truncamento). Ver
  `MODELO_REGULAMENTACAO_IA.md` para o modelo completo de permissões.
- **IA-Coletora (captura auditada):** propostas de escrita com trilha de auditoria
  (`ia-capture*.ts`, tabelas `ai_capture_sessions`/`ai_audit_log`).
- **Mental / Quarto / Casa / Inclusão:** journaling e confrontos de crença (`mental.ts`,
  tabela `belief_confrontations`), rituais do quarto (`quarto-rituals.functions.ts`),
  intenção da Casa / inclusão (`area-extra.ts`).
- **Sono:** alarme, sessão de despertar, snooze, sonhos (`wake.functions.ts` — hoje só como
  *server function*, sem rota de chat dedicada; ver "Divergências").
- **Social:** amizades, grupos, feed com mídia (`social.ts`, `feed.ts`, `post-events.ts`),
  chat de grupo (`group-chat.ts`), moderação/bloqueio (`moderation.ts`), círculos (`circles.ts`).
- **Desafios estilo GymRats (`/circulo`):** desafios de grupo com check-in, ranking,
  calendário de participação, auto-post no feed ao concluir treino
  (`challenges.ts`, tabela `challenge_checkins` + triggers/RPCs `challenge_leaderboard`,
  `challenge_calendar`, `finalize_challenge`). Ver `.lovable/plan.md` para o plano original
  desta feature (já implementada — plano fica só como referência histórica do desenho).
- **Orientador ↔ aluno:** vínculo, snapshot do aluno, mensagens (`orientador.ts`,
  `orientador-chat.ts`).
- **Notificações e push:** in-app + Web Push (VAPID), nudges automáticos via webhook/cron
  (`notifications.ts`, `push*.ts`).
- **Wearables:** import/parse de amostras e conexões (`wearables.ts`).
- **Pagamentos:** Stripe Embedded Checkout, planos (`stripe.ts`/`.server.ts`, rota `/planos`).
- **Studio:** painel administrável de recompensas/desafios (`studio.ts`, gate de admin).
- **PWA:** manifest, service worker, tema com script anti-FOUC, viewport guard mobile-first.
- **Redesign "Forja"** em andamento (ver `DESIGN_PLAN.md`): `/home` já é o piloto do novo
  sistema visual (HUD, MonthGlance, HabitTrackerStrip, QuickCreate, TrackingShortcuts);
  `/mapa` agora **redireciona** para `/home` — o layout antigo foi movido para
  `src/_legacy/MapaLegacy.tsx` (só referência, não carregado em produção).

## Autenticação (4 esquemas)

1. **Páginas** (`_authenticated/route.tsx`) — `beforeLoad` via `supabase.auth.getUser()`;
   sem sessão → redirect `/auth`; gate de onboarding (`profiles.onboarding_completed`).
2. **API de IA** (`/api/chat`, `/api/converse`, `/api/assistant`, `/api/sleep-chat`,
   `/api/ia-capture`) — `Authorization: Bearer <JWT Supabase>`, validado via `getClaims`.
3. **Webhooks** (`/api/public/hooks/*`) — header `apikey`/`x-api-key`; usam **service_role**
   internamente (pensados para pg_cron/Edge Functions).
4. **MCP** (`/mcp`) — OAuth 2.0 via Supabase (audience `authenticated`); descoberta em
   `/.well-known/oauth-protected-resource`, consentimento em `/.lovable/oauth/consent`.

Regra de ouro de dados: cliente browser (`integrations/supabase/client.ts`, anon key) sempre
sob **RLS**; `client.server.ts` (`supabaseAdmin`, service_role) só nos webhooks; endpoints de
IA usam cliente derivado do JWT do usuário (continua sob RLS) — a IA nunca vê dado de terceiro.

## Rotas registradas (estado atual do código, `src/routes/`)

### Públicas
`/` · `/auth` · `/checkout/return` · `/sitemap.xml` · `/.lovable/oauth/consent`

### Autenticadas (`_authenticated/`)
`/agenda` · `/area/$slug` · `/assistente` · `/calendario` · `/circulo` ·
`/circulo/desafio/$id` · `/conquistas` · `/conversar` · `/desafios` · `/dormir` ·
`/habitos` · `/home` · `/ia` · `/jornada` · `/loja` · `/mapa` (→ redireciona para `/home`) ·
`/mental` · `/missoes` · `/notificacoes` · `/onboarding` · `/orientador-chat` · `/perfil` ·
`/plano-alimentar` · `/preferencias-notificacoes` · `/progresso` · `/ritual` · `/social` ·
`/studio` · `/treino` · `/treino/historico/$sessionId` · `/wearables`

### API
| Método | Rota | Auth |
|---|---|---|
| POST | `/api/chat` | Bearer JWT |
| POST | `/api/converse` | Bearer JWT |
| POST | `/api/assistant` | Bearer JWT — agente com tool-calling (propõe, não grava) |
| POST | `/api/sleep-chat` | Bearer JWT |
| POST | `/api/ia-capture` | Bearer JWT |
| POST | `/api/public/hooks/generate-nudges` | apikey (webhook) |
| POST | `/api/public/hooks/push-notification` | apikey (webhook) |

### MCP
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/mcp` | OAuth Supabase | Endpoint MCP (JSON-RPC) do `personal-ia-mcp` |
| GET | `/.mcp/list-tools` | OAuth Supabase | Lista as tools |
| POST | `/.mcp/invoke-tool/$tool` | OAuth Supabase | Invoca uma tool por nome |
| GET | `/.well-known/oauth-protected-resource` | Público | Descoberta OAuth |

Tools MCP: `get_profile`, `list_missions`, `list_habits`, `list_notifications` (read-only) e
`generate_nudges` (escrita, idempotente) — em `src/lib/mcp/tools/`.

## Banco de dados

**71 migrations** em `supabase/migrations/`. Núcleo: `profiles`, hábitos/missões/quests,
cristais/loja, conquistas, social (feed, grupos, bloqueios). Camadas por feature, mais
recentes primeiro:
- Treino: `workout_plans`, `workout_sessions`, `workout_progress`.
- Diário alimentar: `food_log_entries`, `meal_plans`, `meal_plan_items`, `meal_logs`.
- Assistente/IA: `assistant_messages`, `user_health_intake` (anamnese).
- Desafios: `challenge_checkins` + triggers (`validate_challenge_checkin`,
  `recalc_challenge_progress`, `auto_group_post_on_checkin`) + RPCs (`challenge_leaderboard`,
  `challenge_calendar`, `finalize_challenge`); reaproveita `groups`, `challenges`,
  `group_weekly_ranking`.
- Notificações/push: `notifications`, `push_subscriptions`, trigger `notify_push_on_insert`
  (via `pg_net`).
- Mental: `belief_confrontations`. Wearables: `wearable_samples`/`wearable_connections`.
- Segurança: `20260708000000_security_hardening_frontend_trust.sql`,
  `20260714203038_add_area_progress_write_policies.sql` (corrigiu RLS que bloqueava
  INSERT/UPDATE do próprio usuário em `area_progress`).

RLS por usuário em todas as tabelas de dado pessoal.

## Trabalho recente (git log, branch `develop`)

- Diário alimentar real: captura por foto, código de barras e manual (substituiu dados
  fabricados do Plano Alimentar).
- Correção de RLS: `area_progress` não permitia INSERT/UPDATE do próprio usuário.
- Correção de tela branca após cadastro (race condition de navegação no router).
- Correção da integração de IA: remapeamento `max_tokens` → `max_completion_tokens`
  (mudança de contrato da API usada) + logging de erro real em vez de engolir silenciosamente.
- Redesenho da tela de Plano Alimentar conforme wireframe.

## Divergências conhecidas nos docs antigos (não corrigidas ainda nos arquivos originais)

`README.md`/`ARCHITECTURE.md` descrevem um estado anterior do projeto (46 rotas, 56
migrations) que já mudou bastante:
- Rotas que **saíram**: `/alarme`, `/classe`, `/cristais` *(verificar se virou parte de `/loja`)*,
  `/despertar`, `/painel`, `/painel-aluno/$id`, `/sonhos`, `/api/wake-chat`.
- Rotas **novas**: `/agenda`, `/assistente`, `/conversar`, `/home`, `/circulo`,
  `/circulo/desafio/$id`, `/treino`, `/treino/historico/$sessionId`, `/plano-alimentar`,
  `/api/converse`, `/api/assistant`.
- `wake.functions.ts` existe mas não há mais rota de chat de sono/despertar dedicada — hoje é
  só *server function*.
- Contagem de migrations: 71 (não 56).
- Provider de IA principal mudou: hoje é a **API da OpenAI** direto (`OPENAI_API_KEY`,
  `ai-gateway.server.ts`), com o Lovable AI Gateway como *fallback* — não o inverso.

**Ação recomendada:** ao próximo ciclo de trabalho no design "Forja" ou nas rotas, atualizar
`README.md`/`ARCHITECTURE.md` para refletir o estado atual (ou aceitar que este `context.md`
é a fonte de verdade rápida e os outros ficam como "arquitetura de referência histórica").

## Rodando localmente

```bash
npm install          # ou bun install
npm run dev          # vite dev -> http://localhost:3000 (Supabase real)
npm run dev:mock     # offline, dados fake, login automático (ver MOCKING.md)
npm run build
npm run lint
```

Env necessárias: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
(+ `VITE_` variantes), `VITE_PAYMENTS_CLIENT_TOKEN` (Stripe). Só servidor:
`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `AI_CHAT_MODEL`/`AI_FALLBACK_MODEL`,
`LOVABLE_API_KEY` (fallback), chaves VAPID, `HOOKS_SECRET`.
