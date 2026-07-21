## Visão

WiMi é **uma única inteligência** que se manifesta em três frameworks operacionais, todos ligados à **mesma memória compartilhada**:

```text
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  ASSISTENTE │   │ PLANEJAMENTO│   │  EXECUÇÃO   │
│  (conversar)│   │  (planejar) │   │  (executar) │
│  livre,     │   │  estrutura: │   │  supervisão │
│  reflexiva  │   │  → blocos   │   │  ao vivo    │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       └────────────┬────┴──────────┬──────┘
                    ▼               ▼
             ┌────────────────────────────┐
             │  MEMÓRIA COMPARTILHADA     │
             │  (contexto, projetos,      │
             │   agreements, telemetria)  │
             └────────────────────────────┘
```

Base para futuro: tríade (3) → 7 → 14 tutores. Nesta rodada preparamos o terreno com **um único "cérebro"** consultável por qualquer framework — para amanhã plugar outras identidades sem refazer a arquitetura.

## O que entra nesta rodada

### 1. Wake Lock 100% flutuante (correção imediata)

- Remover o botão ☕ do `AppBottomBar.tsx`.
- `FocusFloatingButton.tsx` passa a aparecer **sempre** que `wake.supported` (não só imersivo/ativo). Estado permanece global no `WakeLockProvider` — já persiste entre rotas.
- Posição adaptativa: `bottom: calc(env(safe-area-inset-bottom) + 88px)` quando barra visível, `+16px` nas rotas imersivas.

### 2. Framework "Planejamento" — nova rota `/planejar`

Interface espelhada da `/assistente`, mas com foco declarado em planejamento. Mesmo composer, TTS, mic, effort selector, memória compartilhada.

- **System prompt especializado**: extrai objetivo → quebra em blocos (horário, duração, área, subtarefas, critério de conclusão) → sempre encerra propondo "gerar blocos".
- **Bloco estruturado na resposta**: WiMi devolve `` ```plan-blocks\n[{...}]\n``` `` que o cliente detecta e renderiza como `PlanBlocksCard` editável (título, hora, duração, área, subtarefas).
- **CTA "Enviar para Executar"**: grava em `scheduled_quests` (hoje) com subtarefas serializadas em `subtitle` (JSON) e redireciona pra `/executar` com toast.
- **Sem migration nova** — `scheduled_quests` + `execution_events` cobrem. Se subtarefas apertarem, migration futura adiciona `tasks jsonb`.

### 3. Framework "Execução" — bloco ativo + chat contextual

`/executar` já tem `LiveClock`, `JourneyTimeline`, `ManifestPanel`, `ExecutarChatDrawer`. Ajustes:

- **Estado de bloco ativo**: clicar num item da timeline promove ele a bloco ativo (relógio grande + subtarefas listadas + botão "Iniciar execução").
- **Iniciar execução**: grava `mission_started` (já existe) e arma os gatilhos `atStart`/`beforeEnd`/`onEnd` do `JourneyAgent` pra esse bloco.
- **Drawer enxuto**: `ExecutarChatDrawer` remove seletor de conversas/histórico; mantém composer + mic + TTS + effort. Injeta no system prompt: bloco ativo, tempo decorrido/restante, tarefas feitas vs pendentes.
- **Intents extras** em `execute-intent.ts`: "marcar tarefa X feita", "pular subtarefa", "registrar progresso: ..." → grava em `execution_events` como `note`.

### 4. Memória compartilhada — camada `wimi-memory`

Fundação para os três frameworks (e para os futuros tutores) consultarem o mesmo contexto.

- **Novo módulo `src/lib/wimi-memory.ts`**: função `buildSharedContext({ scope })` que devolve um objeto padronizado com:
  - identidade da IA (nome dinâmico já existente),
  - momento do usuário (`client-moment.ts` — já existe),
  - projetos/goals ativos (`strategic_goals`),
  - blocos do dia (`scheduled_quests`),
  - agreements da jornada (`journey-agreements.ts`),
  - últimos N eventos de telemetria (`execution_events`).
- **`scope`**: `"assistente" | "planejar" | "executar"` — cada framework pede as fatias que precisa (executar puxa mais telemetria, planejar puxa mais goals, assistente é o mais amplo).
- **Todos os três frameworks passam a chamar `buildSharedContext(scope)`** ao montar o system prompt. Nada de prompt hard-coded por rota — a mesma fonte alimenta as três manifestações.
- **Preparação pra tríade**: a assinatura já leva `agentIdentity` opcional (default: WiMi). Quando plugarmos o 2º/3º tutor, cada um recebe o mesmo contexto com identidade própria.

### 5. Ponto de entrada

- `CaminhosPanel.tsx` — o card "Planejar" agora aponta pra `/planejar` (hoje vai pra `/assistente?seed=...`).
- Manter compatibilidade: `/assistente?seed=planejar:...` continua funcionando (redireciona pra `/planejar` com seed).

## Ordem de implementação

1. **Wake Lock flutuante** (isolado, 2 arquivos, sem risco).
2. **`wimi-memory.ts`** (fundação — antes das rotas pra elas já nascerem consumindo).
3. **`/planejar`** (rota nova + `PlanBlocksCard` + detecção do bloco `plan-blocks` no stream).
4. **`/executar` — bloco ativo + drawer enxuto + intents novos**.
5. **`CaminhosPanel` — redirecionar "Planejar"**.

## Fora de escopo desta rodada

- Segunda/terceira identidade de tutor (só a fundação `agentIdentity` fica pronta).
- Editor visual avançado de blocos (drag/split) — edição inline agora, drag depois.
- Sincronização Google Calendar dos blocos gerados — botão opcional em rodada futura.
- Sistema descentralizado / DAO de tutores — visão futura, não é código agora.
- Multiusuário (atribuir tarefa a outra pessoa) — tudo pro próprio usuário por enquanto.

## Detalhes técnicos

**Arquivos novos**
- `src/routes/_authenticated/planejar.tsx`
- `src/components/planejar/PlanBlocksCard.tsx`
- `src/lib/planejar-intent.ts` (parse do bloco `plan-blocks` no stream)
- `src/lib/wimi-memory.ts` (contexto compartilhado)

**Arquivos editados**
- `src/components/shell/AppBottomBar.tsx` — remove bloco Wake Lock
- `src/components/shell/FocusFloatingButton.tsx` — sempre visível + posição adaptativa
- `src/routes/_authenticated/executar.tsx` — bloco ativo + botão "Iniciar"
- `src/components/executar/ExecutarChatDrawer.tsx` — enxugar UI + contexto do bloco
- `src/lib/execute-intent.ts` — intents de progresso
- `src/components/home/panels/CaminhosPanel.tsx` — rota "Planejar"
- `src/routes/_authenticated/assistente.tsx` — passa a montar prompt via `buildSharedContext("assistente")`

**Sem migrations**. Sem novas dependências.
