# Fase 1 — Onboarding + Avatar + Oráculo do Diagnóstico

Foco: transformar o signup numa **jornada de entrada no mundo Personal IA**. Logo após criar conta, o usuário passa por 3 módulos curtos que definem **quem é** (Avatar), **o que quer** (Objetivo) e **como é** (Classe Comportamental). No fim, o Oráculo entrega um diagnóstico inicial e desbloqueia o Mapa com a primeira Quest do Dia personalizada.

## Escopo

### Fluxo
1. **Signup** (já existe) → após criar conta, em vez de cair direto no `/mapa`, vai para `/onboarding`.
2. **/onboarding** — wizard vertical de 3 módulos + 1 tela de diagnóstico final:
   - **Módulo 1 — Avatar**: nome de exibição, idade, gênero (M/F/Outro/Prefiro não dizer), altura, peso, foto opcional (skip permitido nesta fase — só placeholder).
   - **Módulo 2 — Objetivo**: foco principal (Emagrecer / Hipertrofia / Saúde geral / Performance / Mente & hábitos), nível atual (Iniciante / Intermediário / Avançado), tempo disponível por dia (15/30/45/60+ min), dias por semana (slider 1–7).
   - **Módulo 3 — Classe Comportamental (Dynamic Intake)**: 6 perguntas adaptativas com escala 1–5 ou múltipla escolha, calculam a **classe** entre: `executor`, `estrategista`, `explorador`, `guardiao`, `visionario`. Algoritmo simples por pontuação por eixo.
   - **Oráculo**: tela final com a classe revelada (animação ember-glow), descrição da classe, e CTA "Entrar no mundo".
3. Após concluir, `onboarding_completed=true` no profile → `/mapa` libera e mostra Quest do Dia gerada a partir das respostas.

### Rotas
- `src/routes/_authenticated/onboarding.tsx` — wizard com state local + step indicator.
- Gate em `_authenticated/route.tsx`: se `profiles.onboarding_completed=false`, redireciona qualquer rota protegida para `/onboarding` (exceto a própria).
- `/perfil` ganha botão "Refazer diagnóstico" (reset opcional).

### Componentes
- `OnboardingShell` — header com progresso (1/4 · 2/4 · 3/4 · Oráculo), botão voltar, animação de transição entre steps.
- `AvatarStep`, `GoalStep`, `BehaviorStep`, `OracleReveal`.
- `ScaleInput` (1–5 com slider/dots), `ChoiceGrid` (cards selecionáveis), `NumberStepper`.
- `ClassBadge` reutilizável (usado no HUD e no Oráculo).

### Backend (migration única)
Estender `profiles`:
- `age int`, `gender text`, `height_cm int`, `weight_kg numeric(5,2)`
- `goal text` (enum-like), `level text`, `time_per_day_min int`, `days_per_week int`
- `behavioral_class` já existe — passa a ser populado pelo cálculo
- `behavior_scores jsonb` (guarda os 5 eixos para futura recalibração)
- `onboarding_completed boolean default false`
- `onboarding_completed_at timestamptz`

Tudo nullable + defaults seguros. RLS já cobre (usuário edita o próprio). Sem novas tabelas nesta fase.

### Lógica de classificação
Função TS pura em `src/lib/behavior.ts`:
- Input: 6 respostas (1–5 ou índice).
- Output: `{ class: BehavioralClass, scores: Record<eixo, number> }`.
- Eixos: `execucao`, `planejamento`, `exploracao`, `cuidado`, `visao`. Classe = eixo de maior score (com tiebreak determinístico).

### Quest do Dia personalizada
`src/lib/quest.ts` — função pura que recebe `{ goal, level, time_per_day_min, behavioral_class }` e devolve `{ title, subtitle, xp }`. Sem persistência ainda (Fase 2). HUD/QuestOfDayCard passam a consumir essa função.

## Critérios de aceite

- Usuário novo: signup → `/onboarding` automaticamente, não consegue acessar `/mapa` antes de concluir.
- Wizard navega forward/back, valida campos obrigatórios, mostra progresso.
- Oráculo revela a classe com animação ember-glow e descrição condizente.
- `profiles` atualizado com todos os campos + `behavior_scores` jsonb + `onboarding_completed=true`.
- HUD do `/mapa` mostra a classe real (não mais "executor" hardcoded) e QuestOfDayCard mostra quest derivada das respostas.
- `/perfil` mostra avatar/objetivo/classe e tem botão "Refazer diagnóstico" que reseta `onboarding_completed`.
- Funciona em 390×844, todos tokens semânticos, sem cores hardcoded, suporta os 7 skins.

## Fora de escopo (fases seguintes)
- Upload real de foto/avatar (Fase 2 ou 3 com Storage).
- Quests persistidas, check-in, XP real (Fase 2).
- IA generativa no Oráculo (Fase 3 — Torre do Mentor com Lovable AI Gateway).

## Arquivos novos/alterados
```
supabase/migrations/<ts>_profile_onboarding.sql
src/lib/behavior.ts
src/lib/quest.ts
src/components/onboarding/OnboardingShell.tsx
src/components/onboarding/AvatarStep.tsx
src/components/onboarding/GoalStep.tsx
src/components/onboarding/BehaviorStep.tsx
src/components/onboarding/OracleReveal.tsx
src/components/onboarding/inputs/{ScaleInput,ChoiceGrid,NumberStepper}.tsx
src/components/map/ClassBadge.tsx
src/routes/_authenticated/onboarding.tsx
src/routes/_authenticated/route.tsx          (gate onboarding_completed)
src/routes/_authenticated/mapa.tsx           (consome classe + quest dinâmica)
src/routes/_authenticated/perfil.tsx         (mostra dados + refazer)
src/components/map/QuestOfDayCard.tsx        (recebe props)
src/integrations/supabase/types.ts           (regenerado pela migration)
```
