# Consolidação do Dump — 5 blocos, 4 fases

Organizei os 5 pontos por domínio, removi duplicações e agrupei em fases executáveis. Cada fase entrega valor sozinha; se algo travar, paramos, ajustamos, seguimos.

## Mapa Dump → Domínio

| # do dump | Domínio | Onde vive hoje | O que muda |
|---|---|---|---|
| 1 | Missões diárias/semanais editáveis + agenda + notificação | `area/treino`, `jornada`, `daily_quests` | Nova aba "Minhas Missões" com CRUD, horário e lembrete |
| 2 | Salvar Treino & Dieta persistidos a partir da anamnese | `TreinoPlanCard`, `CozinhaDietCard` | Persistência real + histórico + versionamento |
| 3 | Modelo individual (IA lê tudo de "Seu Mundo") | IA-Agregadora + `area_progress` | Perfil vivo consultável pela IA em toda geração |
| 4 | Missões do Quarto (rituais de sono) + integração Samsung Health | `area/quarto`, `QuartoSleepCard` | CRUD de rituais noturnos + placeholder de integração wearables |
| 5 | Diário mental com calendário e enfrentamento diário | `MentalJournalCard`, `mental_journal` | Vista de calendário + "enfrentei hoje?" toggle diário |

## Fase 1 — Missões editáveis, agendáveis e com lembrete (item 1)

O usuário precisa hoje de um lugar para **criar, agendar e riscar** missões do dia/semana, além das sugeridas pela IA. É o bloqueio mais visível.

- Nova tabela `user_missions` (título, área, tipo `daily|weekly`, `scheduled_time`, `remind_before_min`, `active`, `notes`) + `user_mission_logs` (por dia, done bool, done_at).
- Nova rota `/_authenticated/missoes` com 3 abas: **Hoje · Semana · Todas**.
- CRUD completo: criar, editar, arquivar, duplicar.
- Presets rápidos por área (Treino de força, Mobilidade 10min, Cardio leve, Progressão de carga do exercício X).
- Agendamento com horário; toast/notificação local usando Notification API + Service Worker já existente (PWA).
- Integração no `BentoArea` da área Treino: botão "+" abre o composer já filtrado por área.
- Corrige o "+" que hoje é reportado como fonte de dor.

## Fase 2 — Treino & Dieta persistidos com histórico (itens 2 e 3)

Hoje `TreinoPlanCard` e `CozinhaDietCard` geram, mas não guardam de forma versionada nem alimentam a IA de volta.

- Tabelas `training_plans` e `diet_plans` com `version`, `source` (`ai_generated|manual|anamnese`), `payload jsonb`, `active`.
- Anamnese estruturada: expandir `profiles` com `anamnesis jsonb` (objetivos, restrições, equipamentos, disponibilidade, biometria opcional).
- `saveActiveTrainingPlan()` / `saveActiveDietPlan()` — RPCs que arquivam a versão anterior e ativam a nova.
- Botão "Salvar como meu plano" em cada card; histórico visível ("v3 · 15/nov").
- **Item 3**: o system prompt da IA-Agregadora passa a incluir automaticamente o snapshot da anamnese + plano ativo + últimos logs de missão/hábito antes de gerar qualquer coisa. É isso que gera o "modelo individual" — sem tabela nova, só contexto.

## Fase 3 — Rituais do Quarto + preparação para wearables (item 4)

- Reutiliza `user_missions` da Fase 1 com `area='quarto'` e `type='night_ritual'` — não precisa de tabela nova.
- Presets sugeridos pela IA a partir de `sleep_logs` e `mental_journal`: "orar antes de dormir", "copo d'água", "sem tela 30min antes", "respiração 4-7-8".
- CRUD manual como as outras missões.
- **Integração Samsung Health / wearables**: implementação real depende de app nativo (Health Connect é Android-only e exige APK assinado). Nesta fase entrega:
  - Campo `wearable_source` em `sleep_logs`.
  - Import manual por CSV/JSON (o que o Samsung Health exporta hoje).
  - Placeholder de "Conectar dispositivo" com texto honesto explicando que a integração nativa virá quando publicarmos o app.
  Isso evita prometer o que o PWA não consegue entregar.

## Fase 4 — Diário Mental com calendário e enfrentamento (item 5)

- Estende `mental_journal` com `belief_text`, `confronted_today bool`, `confronted_dates date[]`.
- Nova rota `/_authenticated/diario` (ou aba dentro de `area/mental`) com:
  - Lista de crenças limitantes ativas.
  - Toggle diário "enfrentei hoje" → grava data.
  - Vista de calendário (heatmap tipo GitHub) mostrando dias com enfrentamento.
  - Timeline: "há 30 dias você escreveu…".
- Integra com a IA-Agregadora: ao abrir a IA na tela do diário, sugestões viram "vamos reescrever essa crença?".

## Ordem sugerida e ponto de decisão

1. **Fase 1 primeiro** — destrava o "+" e o pedido mais concreto (missões editáveis + agenda).
2. **Fase 2** — dá memória real ao sistema; habilita o modelo individual do item 3.
3. **Fase 3** — herda a infra da Fase 1; entrega os rituais e é honesta sobre wearables.
4. **Fase 4** — polimento humano do lado mental.

Se você concordar com essa divisão, começo pela **Fase 1** já: migration `user_missions` + `user_mission_logs`, rota `/missoes` com 3 abas, presets de Treino, composer com horário e lembrete via Notification API, e o "+" das áreas passando a abrir o composer certo.

Me diga: **sigo pela Fase 1 nessa ordem, ou você quer trocar a prioridade?**
