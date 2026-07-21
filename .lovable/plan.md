
# Tela viva de execução — `/executar` como palco da WiMi + telemetria persistida

Objetivo: transformar `/executar` numa tela de acompanhamento em tempo real (relógio pulsando, timeline, WiMi se manifestando com voz + mic) **e** gravar toda a telemetria da execução no banco. Os dados alimentam análise futura de padrões (aderência, negociações, atrasos, cadência).

---

## 1. Estrutura visual

```text
┌────────────────────────────────────────────┐
│  EXECUÇÃO · 14:37:22    ● ao vivo          │  ← relógio grande, tick 1s
│  bloco atual: Deep Work                    │
│  ▓▓▓▓▓▓▓▓▓▓░░░░  32min restantes           │
├────────────────────────────────────────────┤
│  TIMELINE DE HOJE                          │
│  ● 09:00  Ritual matinal        ✓ feito    │
│  ● 10:00  Deep Work  ▶ AGORA (32min)       │  ← ember + glow
│  ○ 12:00  Almoço             em 1h23       │
│  ○ 14:00  Sprint 2           em 3h23       │
├────────────────────────────────────────────┤
│  MANIFESTAÇÃO DA WIMI (só quando há evento)│
│  "faltam 5min. como tá indo?"              │
│  [🎙 ouvindo… "vou estender 20"]           │
│  [✓ feito] [+5] [+10] [+20] [pular] [falar]│
├────────────────────────────────────────────┤
│  LOG DE HOJE  (recolhível)                 │
│  14:00 · Deep Work · estendido +20         │
│  10:00 · Ritual matinal · feito            │
└────────────────────────────────────────────┘
```

## 2. Persistência — 2 tabelas novas

### 2.1 `execution_events` — cada momento observável da jornada
Fonte da verdade da telemetria. Cada linha é um evento atômico com contexto suficiente pra análise sem joins caros depois.

```sql
CREATE TABLE public.execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,
  event_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN (
    'manifest_shown',     -- WiMi se manifestou (preEnd/atEnd/preStart)
    'manifest_ack',       -- usuário reagiu (clicou/falou)
    'mission_done',       -- concluída pelo painel
    'mission_skipped',    -- pulada pelo painel
    'mission_extended',   -- estendida em N minutos
    'mission_started',    -- entrou no bloco
    'mission_ended',      -- saiu do bloco (tempo esgotado)
    'voice_note',         -- fala capturada
    'negotiation'         -- ajuste de trilha via conversa
  )),
  phase text CHECK (phase IN ('preEnd','atEnd','preStart')),
  channel text CHECK (channel IN ('foreground','push','voice','manual')),
  latency_ms int,         -- ms entre manifest_shown e manifest_ack (nulo se n/a)
  delta_min int,          -- p/ mission_extended: minutos adicionados (+/-)
  note text,              -- transcrição curta ou observação (<=500 chars)
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,  -- extras (block title, área, etc)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- índices para análises típicas
CREATE INDEX ON public.execution_events (user_id, event_date DESC);
CREATE INDEX ON public.execution_events (user_id, mission_id, occurred_at DESC);
CREATE INDEX ON public.execution_events (user_id, kind, occurred_at DESC);
```

Grants + RLS: SELECT/INSERT pro dono; UPDATE/DELETE bloqueados (telemetria é imutável); service_role ALL pra jobs de análise.

### 2.2 `execution_sessions` — resumo diário por bloco
Denormalizado pra dashboards e análise semanal ficarem baratos. Atualizado por trigger a partir de `execution_events`.

```sql
CREATE TABLE public.execution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  planned_start_min int,       -- minutos desde 00:00 (planejado)
  planned_end_min int,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  extensions_total_min int NOT NULL DEFAULT 0,
  manifest_count int NOT NULL DEFAULT 0,
  ack_count int NOT NULL DEFAULT 0,
  avg_ack_latency_ms int,
  outcome text CHECK (outcome IN ('done','skipped','abandoned','in_progress')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, session_date)
);
CREATE INDEX ON public.execution_sessions (user_id, session_date DESC);
```

Grants + RLS iguais. Um trigger `AFTER INSERT ON execution_events` atualiza `execution_sessions` (upsert por `(user_id, mission_id, session_date)`), incrementando contadores e recalculando média de latência. Simples, robusto, sem depender do cliente pra manter agregados.

### 2.3 Extensão de missão — helper SQL
Para o botão "+N min", em vez de UPDATE direto no cliente, criar RPC `extend_mission_today(_mission uuid, _minutes int)` (SECURITY DEFINER, valida `auth.uid()`): atualiza `end_time` da missão e insere `execution_events{kind:'mission_extended', delta_min}` na mesma transação. Garante que a métrica nunca fica sem o evento.

## 3. Escrita da telemetria — server function

`src/lib/execution.functions.ts` (autenticada):
- `logExecutionEvent({ mission_id?, kind, phase?, channel, latency_ms?, delta_min?, note?, meta? })` — insere em `execution_events`. Cliente chama uma vez por evento.
- `extendMissionToday({ mission_id, minutes })` — chama a RPC acima; retorna a missão atualizada.
- `getTodayExecutionLog()` — SELECT em `execution_events` do dia (usado pelo card "log de hoje").

Todas via `requireSupabaseAuth`. Zod nos validators. Nada de admin client.

## 4. Manifestação in-place (sem sair do `/executar`)

Monta `JourneyAgent` local no `/executar` com handler próprio. Quando dispara:
1. Renderiza `ManifestPanel` ancorado ao rodapé (acima da bottom bar).
2. `vibrateFor(phase)` + `playPing()` (helpers existentes).
3. `logExecutionEvent({ kind:'manifest_shown', phase, channel:'foreground', mission_id })` — marca `shownAt = performance.now()`.
4. Se `notify.voice`: fala via TTS (extrair helper `playAssistantTts` compartilhado).
5. Após `onended`, se `notify.autoMic`: liga `useSpeechToText` por até 20s.
6. Qualquer ação do usuário (botão ou fala reconhecida) → `logExecutionEvent({ kind:'manifest_ack', latency_ms: now - shownAt, ... })` + evento específico (`mission_done` / `mission_extended` / `mission_skipped` / `voice_note`).

## 5. Negociação de tempo

- **Concluir** → `markMissionToday(done)` + `logExecutionEvent('mission_done')`.
- **+N min** (chips 5/10/20 + custom) → `extendMissionToday({minutes:N})` (RPC já loga `mission_extended`) → re-sync push (`syncJourneyPushSchedule`) pra reagendar `atEnd`.
- **Pular** → `markMissionToday(done:false)` + `logExecutionEvent('mission_skipped')`.
- **Falar livre** → transcrição vai pra `voice_note`. Parser determinístico (`src/lib/execute-intent.ts`, regex simples) detecta "mais N minutos", "terminei", "pular" e dispara a ação equivalente sem exigir botão. IA fica fora daqui — barato e previsível; se o parser falhar, botão "Conversar com WiMi" leva pra `/assistente?seed=manifest:...`.

## 6. Log da jornada (UI)

Card recolhível abaixo da timeline lê `getTodayExecutionLog()` via TanStack Query, `staleTime: 15s` + invalidate após cada mutação. Mostra linha por evento relevante (`manifest_ack`, `mission_done`, `mission_extended`, `mission_skipped`, `voice_note`). Fonte única de verdade — mesmo dado que a análise de padrões vai consumir.

## 7. Reentrada por push

- Push existente já leva pra `/assistente?seed=manifest:<id>:<phase>`.
- Adicionar também suporte a `/executar?seed=manifest:<id>:<phase>` e mudar a `url` do push em `journey-tick.ts` pra apontar pra `/executar` (padrão novo). Ao abrir, o `/executar` dispara o `ManifestPanel` imediatamente com `channel:'push'` no log.
- Botão "conversar" dentro do painel continua levando pro `/assistente`.

## 8. Análise futura (fora deste escopo, mas o esquema já suporta)

Com `execution_events` e `execution_sessions` no lugar, dá pra derivar sem migrations novas:
- aderência por área/dia da semana/horário;
- latência média de reação por fase (preEnd vs atEnd vs preStart);
- taxa de extensão por bloco (quais missões o usuário sempre estende);
- efetividade dos canais (`foreground` vs `push`);
- padrões de abandono (blocos que viram `abandoned` no fim do dia via job).

Deixamos comentado no código onde plugar a view materializada semanal quando for hora.

## 9. Arquivos

**Novos**
- Migration: `execution_events` + `execution_sessions` + trigger de agregação + RPC `extend_mission_today` + GRANTs + RLS.
- `src/lib/execution.functions.ts` — server fns autenticadas (log, extend, getTodayLog).
- `src/lib/execute-intent.ts` — parser determinístico da fala.
- `src/lib/tts-play.ts` — helper compartilhado `playAssistantTts(text)`.
- `src/components/executar/LiveClock.tsx`.
- `src/components/executar/JourneyTimeline.tsx`.
- `src/components/executar/ManifestPanel.tsx`.
- `src/components/executar/ExecutionLogCard.tsx`.

**Editados**
- `src/routes/_authenticated/executar.tsx` — nova arquitetura (clock + timeline + JourneyAgent local + ManifestPanel + log). Kanban atual vira seção colapsável no fim pra não regredir.
- `src/routes/_authenticated/assistente.tsx` — extrair TTS pro helper compartilhado (sem mudança visual); manifestações do assistente também chamam `logExecutionEvent` (fonte única).
- `src/routes/api/public/hooks/journey-tick.ts` — trocar `url` do push pra `/executar?seed=...`.
- `src/lib/journey-schedule.functions.ts` — sem mudança de contrato; só documenta que o alvo agora é `/executar`.

**Sem mudança**
- `JourneyAgent.tsx`, `JourneyManifestFX.ts`, `journey-agreements.ts`, `useActiveJourney.ts`, migration `journey_push_schedule`, cron.

## 10. Ordem de implementação
1. **Migration** (tabelas + trigger + RPC + RLS/GRANTs) — precede tudo pra tipos regenerarem.
2. `execution.functions.ts` + `tts-play.ts` + `execute-intent.ts`.
3. `LiveClock` + `JourneyTimeline` + refactor visual do `/executar`.
4. `ManifestPanel` com `JourneyAgent` local + integração completa (voz + mic + logs + extend).
5. `ExecutionLogCard` lendo do banco.
6. Trocar URL do push pra `/executar` e testar reentrada.

## Fora de escopo
- Dashboard analítico dos eventos (o dado fica pronto pra próxima fase).
- IA-parser da fala livre (regex determinístico agora).
- Reescrever o Kanban de `scheduled_quests` (só recolher).
