# Fase 2 — Quests, Check-in Diário e XP Real

Foco: transformar a Quest do Dia (hoje só visual) em um **loop de progressão real**. Usuário recebe quest diária persistida, faz check-in, ganha XP, sobe de nível, mantém streak. É o primeiro ciclo de gameplay funcional do Personal IA.

## Escopo

### Fluxo principal
1. Ao abrir `/mapa`, sistema garante que existe uma quest do dia para o usuário (cria se for o primeiro acesso do dia).
2. Quest do Dia card mostra estado: **pendente** (CTA "Fazer check-in") ou **concluída** (badge + XP ganho, animação ember).
3. Check-in abre bottom sheet com:
   - Confirmação ("Você completou?")
   - Campo opcional de nota curta (até 140 chars)
   - Slider de esforço (1–5)
4. Submit → grava `quest_checkins`, soma XP no profile, atualiza streak (incrementa se ontem teve check-in, reseta se quebrou), retorna animação +XP no HUD.
5. Histórico básico em `/perfil` → últimas 7 quests com status.

### Telas / componentes
- `QuestOfDayCard` (atualiza): aceita estado `pending | completed`, mostra XP ganho, botão check-in.
- `CheckinSheet` — bottom sheet com formulário (esforço + nota).
- `XPToast` — animação flutuante "+50 XP" quando completa.
- `StreakBadge` no HUD com pulso quando atualiza.
- `QuestHistory` — lista compacta no `/perfil` (data, área, esforço, XP).

### Backend (migration única)
Tabela `daily_quests`:
- `id uuid pk`, `user_id uuid → auth.users on delete cascade`
- `quest_date date` (YYYY-MM-DD na TZ do servidor)
- `area_slug text`, `title text`, `subtitle text`, `xp_reward int`
- `status text` default `'pending'` (`pending|completed|skipped`)
- `completed_at timestamptz`, `effort int` (1–5), `note text`
- `created_at`, `updated_at`
- `unique(user_id, quest_date)`

Tabela `xp_events` (audit + futuro feed):
- `id`, `user_id`, `source text` ('quest'|'bonus'|'streak'), `amount int`, `ref_id uuid`, `created_at`

Triggers/funções:
- `award_quest_xp()` — trigger AFTER UPDATE em `daily_quests` quando status muda para `completed`: insere `xp_events`, soma `xp` em `profiles`, recalcula `streak` (compara `quest_date` com último check-in).
- RLS: tudo `auth.uid() = user_id`. GRANTs autenticated + service_role.

### Server functions (TanStack)
- `ensureTodayQuest()` — `requireSupabaseAuth`: busca quest de hoje, cria via `buildDailyQuest` se não existir, retorna row.
- `completeQuest({ id, effort, note })` — valida com zod, faz UPDATE para `completed` (trigger faz o resto), retorna `{ xp_gained, new_xp, new_streak, leveled_up }`.
- `listRecentQuests(limit=7)` — histórico para perfil.

Arquivos: `src/lib/quests.functions.ts`.

### Rotas alteradas
- `_authenticated/mapa.tsx` — usa `useQuery(['today-quest'])` + `useServerFn(ensureTodayQuest)`. Mutation `completeQuest` invalida quest + profile.
- `_authenticated/perfil.tsx` — adiciona seção "Últimas missões".

### Lógica de streak
- Se `last_quest_date == hoje - 1` → `streak += 1`.
- Se `last_quest_date == hoje` → no-op (já contado).
- Caso contrário → `streak = 1`.
- Reset automático: na criação da quest de hoje, se gap > 1 dia desde a última `completed`, zera streak.

### Level up
- Fórmula: `level = floor(xp / 500) + 1` (mantém atual).
- `leveled_up = true` quando crossing → toast especial "NÍVEL X" com ember-glow forte.

## Critérios de aceite
- Abrir `/mapa` cria/retorna quest do dia consistente (mesma quest até meia-noite).
- Check-in persiste, soma XP no HUD em tempo real, streak atualiza corretamente, animação aparece.
- Segundo check-in no mesmo dia bloqueado (botão desaparece, card mostra "Concluída hoje").
- `/perfil` lista últimas 7 missões.
- Streak quebra corretamente após pular um dia.
- Funciona nos 7 skins, mobile 390px, tokens semânticos, sem cores hardcoded.

## Fora de escopo
- Múltiplas quests/dia, quests longas (Fase 3).
- IA generativa pra título da quest (Fase 3 — Torre do Mentor).
- Conquistas/badges, ranking social.

## Arquivos novos/alterados
```
supabase/migrations/<ts>_daily_quests.sql
src/lib/quests.functions.ts
src/components/map/QuestOfDayCard.tsx        (estados pending/completed)
src/components/map/CheckinSheet.tsx
src/components/map/XPToast.tsx
src/components/profile/QuestHistory.tsx
src/routes/_authenticated/mapa.tsx
src/routes/_authenticated/perfil.tsx
src/integrations/supabase/types.ts           (regen pós-migration)
```
