# Fase 3 — Expansão do loop (4 etapas)

Você pediu todas as 4 trilhas. Vou entregar uma de cada vez, sem misturar, validando antes de avançar.

## Etapa 3.1 — Hábitos diários + streaks múltiplos *(começo agora)*
Base que alimenta as outras três (cada hábito vira fonte de XP e gancho pras quests por área).

- Tabela `habits` (user_id, title, icon, area_slug, target_per_week, active) + `habit_logs` (habit_id, log_date unique por dia, status).
- Trigger `award_habit_xp` (espelha `award_quest_xp`, +10 XP por log, não toca streak global).
- Streak individual calculado por hábito (view ou função `habit_streak(habit_id)`).
- UI: nova rota `_authenticated/habitos.tsx`, card `HabitRow` com toggle de check diário e mini-fogo de streak. Entrada no `BottomNav` e atalho na `mapa.tsx` (tile pequeno "Hábitos").
- Seed: ao concluir onboarding, criar 3 hábitos sugeridos pela classe (ex.: Executor → "10 min foco", "Água 2L", "Mover o corpo").

## Etapa 3.2 — Áreas com missões próprias
- Tabela `area_missions` (area_slug, title, subtitle, xp, weekly_target, classe_affinity[]).
- Tabela `area_progress` (user_id, area_slug, level, xp) com trigger somando XP de quests/hábitos por área.
- `area.$slug.tsx` deixa de ser placeholder: lista 3-5 missões da semana + barra de nível da área.
- `BentoArea` mostra nível e brasa proporcional ao progresso.
- Seed inicial de 4 missões por área (40 missões), curadas por afinidade de classe.

## Etapa 3.3 — Skill tree + classes evolutivas
- Tabela `skill_perks` (classe, tier, title, description, unlock_level) + `user_perks` (user_id, perk_id, unlocked_at).
- Função `check_perk_unlocks(user_id)` chamada após `award_quest_xp`/`award_habit_xp`.
- Títulos por tier: Aprendiz (1) → Executor (5) → Mestre Executor (15) → Arquiteto (30).
- Rota `_authenticated/classe.tsx` com árvore vertical (tiers 1/5/10/15/20/30), perks bloqueados/desbloqueados, toast ao destravar.

## Etapa 3.4 — Orientador (chat IA)
- Server route `src/routes/api/chat.ts` usando Lovable AI Gateway (`google/gemini-3-flash-preview`), AI SDK + `requireSupabaseAuth`.
- Contexto injetado: classe, XP, streak, último check-in, hábitos ativos, áreas em atraso.
- Tabela `oracle_messages` (thread única por usuário, persistência em DB — o "Orientador" é uma entidade contínua, não threads).
- Rota `_authenticated/area.orientador.tsx` vira chat real com AI Elements + markdown, composer fixo, scroll automático.

## Aceite por etapa
Cada etapa termina com: migration aprovada → UI funcional em 390px → loop testado (log de hábito soma XP / missão de área completa sobe nível da área / perk destrava / orientador responde com contexto real).

**Vou começar pela 3.1 (Hábitos) assim que aprovar este plano.**