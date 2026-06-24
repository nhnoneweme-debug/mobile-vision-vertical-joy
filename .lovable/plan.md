
# Personal IA — Fase 0: Shell Mobile + Mapa 2D + Cloud

Foco: entregar a **casca navegável** do mundo Personal IA, 100% vertical/mobile, sem features ainda. Cada área é uma rota real com placeholder, pronta para receber as fases 1, 2, 3 depois. Backend já ligado para login e perfil mínimo.

## Direção visual travada

- Paleta: charcoal `#1a1a1a` / `#2d2d2d` / `#4a4a4a` + accent brasa `#e85d3a` (tokens semânticos no `src/styles.css`)
- Tipografia: Bebas Neue (display/headings/HUD) + Barlow (body/labels), via `<link>` no `__root.tsx`
- Layout: bento grid mobile para o mapa, viewport-alvo 390×844
- Tom: dark premium, físico, RPG moderno — sem roxo, sem cartoon infantil

Defino o viewport do preview como **mobile** desde o início.

## Escopo da Fase 0

### Telas
1. **Splash / Boas-vindas** (`/`) — logo, frase do produto, CTA "Entrar / Criar conta".
2. **Auth** (`/auth`) — login + signup (email/senha) com Lovable Cloud.
3. **Home / Mapa do mundo** (`/mapa`) — HUD topo + bento das 10 áreas + nav inferior.
4. **10 áreas placeholder** (`/area/casa`, `/area/missoes`, `/area/treino`, `/area/cozinha`, `/area/quarto`, `/area/mental`, `/area/social`, `/area/coach`, `/area/progresso`, `/area/orientador`) — cabeçalho com nome da área, breve descrição do que virá, botão voltar.
5. **Perfil** (`/perfil`) — dados básicos do usuário logado + logout.

### Componentes
- `MobileShell` — wrapper vertical com safe areas e nav inferior fixa.
- `HUD` — avatar placeholder, nome, classe ("Executor" hardcoded por enquanto), barra de XP, contador de streak com chama.
- `QuestOfDayCard` — banner placeholder destacado no topo do mapa.
- `BentoArea` — tile do mapa com ícone, nome, status (`novo` / `bloqueado` / `n quests`).
- `BottomNav` — 4 ícones: Mapa, Missões, Coach IA, Perfil.
- `AreaPlaceholder` — layout reutilizável para as 10 telas internas.

### Backend (Lovable Cloud)
- Ativar Cloud.
- Auth email/senha habilitado, sem confirmação de email (para acelerar testes).
- Tabela `profiles` (id = auth.users.id, display_name, behavioral_class default `executor`, xp default 0, streak default 0, created_at). RLS: usuário só lê/edita o próprio.
- Trigger `handle_new_user` cria row em `profiles` no signup.
- Rota `_authenticated` protege `/mapa`, `/area/*`, `/perfil`. Não-autenticados vão para `/auth`.

### Fora de escopo (fases seguintes)
- Dynamic Intake Engine, quests reais, XP real, NPCs/IA, treino, fotos, grupos, painel do orientador, mapa interativo com pixel-art. Tudo isso vira fases 1+.

## Detalhes técnicos

- **Stack**: TanStack Start + Tailwind v4 (já configurado). Sem libs extras nesta fase além de `lucide-react` (já presente).
- **Fontes**: `<link>` para Google Fonts (Bebas Neue + Barlow) no `head` do `__root.tsx`. Tokens `--font-display` e `--font-body` em `@theme`.
- **Tokens novos** no `src/styles.css`: `--ember`, `--ember-glow`, `--charcoal-900/800/700`, sobrescrevendo `--background`, `--foreground`, `--primary`, `--card`, `--border` para o tema dark premium. Tudo via `oklch`.
- **Rotas TanStack** (convenção flat dot):
  - `src/routes/index.tsx` (splash)
  - `src/routes/auth.tsx`
  - `src/routes/_authenticated.tsx` (gate)
  - `src/routes/_authenticated.mapa.tsx`
  - `src/routes/_authenticated.area.$slug.tsx` (uma rota dinâmica cobre as 10 áreas via slug)
  - `src/routes/_authenticated.perfil.tsx`
- **Bento grid**: CSS grid `grid-cols-4` mobile com tiles ocupando `col-span` e `row-span` variados; quest-do-dia full-width acima do bento; HUD sticky.
- **Migration única** para `profiles` + RLS + grants (`authenticated`, `service_role`) + trigger `on_auth_user_created`.

## Estrutura de arquivos (novos/alterados)

```text
src/
  styles.css                        (tokens dark premium + fontes)
  routes/
    __root.tsx                      (link fontes, meta PT-BR)
    index.tsx                       (splash)
    auth.tsx
    _authenticated.tsx              (gate de sessão)
    _authenticated.mapa.tsx
    _authenticated.area.$slug.tsx
    _authenticated.perfil.tsx
  components/
    shell/MobileShell.tsx
    shell/BottomNav.tsx
    map/HUD.tsx
    map/QuestOfDayCard.tsx
    map/BentoArea.tsx
    map/areas.ts                    (config das 10 áreas: slug, nome, ícone, status, span)
    placeholders/AreaPlaceholder.tsx
supabase/migrations/
  <timestamp>_profiles.sql
```

## Critérios de aceite

- Abrir o preview em mobile mostra splash → auth → mapa.
- Mapa renderiza HUD, quest-do-dia, 10 tiles em bento, nav inferior. Tudo legível em 390px.
- Tocar qualquer tile abre a rota da área com placeholder e botão voltar.
- Signup cria row em `profiles` automaticamente; perfil mostra nome e classe.
- Logout funciona. Rotas protegidas redirecionam para `/auth`.
- Zero classes hardcoded de cor (`text-white`, `bg-[#...]`) — só tokens semânticos.
- Build limpa, sem placeholders Lovable remanescentes.

## Próximas fases (preview, não construir agora)

- Fase 1: Onboarding + Avatar + Dynamic Intake (Módulos 1–3) com Oráculo do Diagnóstico.
- Fase 2: Centro de Missões real (quests, XP, streak, check-in) com persistência.
- Fase 3: Torre do Mentor (IA Coach via Lovable AI Gateway) + Templo do Progresso (Personal IA Score).
- Fase 4: Sala do Orientador (papéis + RLS por papel) e grupos.
