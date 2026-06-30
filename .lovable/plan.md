
# Fase F — Companheira do Despertar ao Dormir

A IA-Coletora vira **companheira contínua** do ciclo diário. O alarme deixa de ser barulho fixo: a IA conversa, adapta intensidade, negocia o snooze, propõe música/pensamento, captura sonhos e conduz a pessoa pelos blocos do dia (cozinha, academia, trabalho, descanso).

---

## F.1 — Alarme Inteligente Conversacional

### Banco
- `wake_alarms` (id, user_id, label, time_local, days_of_week int[], timezone, enabled, wake_style [gentle|firm|energetic|custom], voice_persona, max_snoozes default 3, snooze_strategy [fixed|adaptive], created_at)
- `wake_sessions` (id, user_id, alarm_id, started_at, woke_at nullable, total_snooze_min, snooze_count, mood_on_wake, dream_logged bool, status [ringing|snoozing|awake|missed])
- `wake_events` (session_id, kind [ring|snooze|interaction|music|thought|wake|miss], payload jsonb, at)

### Lógica de despertar
1. **Ring inicial**: PWA dispara notification + (se app aberto) som progressivo. Tela full-screen mostra **chat ao vivo** com a IA: "Oi, acordou? Tô aqui no controle — música, pensamento, deixar tocar?"
2. **Snooze adaptativo**: a cada interação, IA decide próximo intervalo (5/10/20 min) com base em:
   - hora prevista vs hora real
   - streak de despertares anteriores
   - humor declarado ("dá mais 10" = suave; sem resposta = sobe intensidade)
   - perfil do usuário (classe, level_track, time_per_day_min)
3. **Modos de estímulo** que a IA pode acionar:
   - Música (preset por mood: calma/energia/foco) — usa Web Audio API + faixas locais ou geradas
   - Pensamento do dia (frase curta poética, gerada com contexto)
   - Quest preview ("hoje sua missão é X — bora?")
4. **Limite e respeito**: após `max_snoozes` ou tempo total, IA muda tom: "Acabou o crédito da cama, te amo, levanta."

### Frontend
- Rota `/alarme` (lista/edição) e `/despertar` (full-screen quando dispara)
- Componente `WakeChat` reaproveita transport do `/api/chat`, mas com `system` de "Companheira do Despertar"
- Background sound loop com fade-in
- Service Worker já existe (PWA) — adicionar `showNotification` + schedule via `setTimeout` quando o app está aberto e fallback de notification para quando fechado

---

## F.2 — Registro de Sonhos

### Banco
- `dream_logs` (id, user_id, session_id nullable, logged_at, raw_text, audio_url nullable, mood, lucidity int 0-10, symbols text[], themes text[], ai_summary, ai_interpretation, created_at)
- Estrutura base de **símbolos recorrentes** alimenta gráfico de padrões ao longo do tempo

### Fluxo
- Logo após "acordei", IA pergunta: "Quer registrar o sonho? Texto ou áudio."
- Captura via voz (MediaRecorder já existe no `/ia`) ou texto rápido
- IA processa: extrai símbolos, tema, humor, gera resumo e interpretação leve (não místico de mais — alinhado ao tom mentor)
- Insere em `dream_logs` via server fn

### Frontend
- Rota `/sonhos` com timeline, busca por símbolo, heatmap de lucidez
- Card "registrar sonho" surge automaticamente em `/despertar` após `status=awake`

---

## F.3 — Jornada Acordar → Dormir

A "espinha dorsal" do dia: a IA acompanha blocos e nos pontos de transição oferece o próximo passo.

### Banco
- `day_blocks` (id, user_id, date, kind [wake|dream|kitchen|move|deep_work|family|wind_down|sleep], started_at, ended_at, completed bool, notes)
- `sleep_logs` (id, user_id, date, bed_at, sleep_at nullable, wake_at nullable, quality 1-5, ritual_done bool)

### Lógica
- `wake_sessions.status=awake` dispara criação de `day_blocks` padrão segundo perfil
- Cada bloco tem CTA da IA: "Bora pra cozinha?" → abre área já existente
- À noite, ritual da noite + `sleep_logs` (reuso da tabela `ritual_logs` para wind_down)
- Tela `/jornada` mostra timeline do dia com blocos consumidos/pendentes

---

## F.4 — Integração com IA existente

- Novo system prompt **"Companheira do Despertar"** quando contexto = sessão de alarme
- IA ganha tools (AI SDK):
  - `setSnooze({ minutes })`
  - `playMusic({ mood })`
  - `speakThought({ text })`
  - `logDream({ raw_text, mood, lucidity })`
  - `markAwake()`
  - `createDayBlock({ kind })`
- Loop com `stopWhen: stepCountIs(50)`
- Captura de contexto reaproveita `src/lib/ai-gateway.server.ts` e padrão de `/api/chat`

---

## Ordem de implementação
1. Migration (`wake_alarms`, `wake_sessions`, `wake_events`, `dream_logs`, `day_blocks`, `sleep_logs`) + RLS + GRANTs
2. Server fns: `createAlarm`, `updateAlarm`, `startWakeSession`, `recordSnooze`, `markAwake`, `logDream`, `createDayBlock`
3. Endpoint `/api/wake-chat` (streamText com tools acima)
4. Rotas: `/alarme`, `/despertar`, `/sonhos`, `/jornada` + entradas no Upper Menu
5. PWA: notification scheduler (best-effort enquanto aberto) + página de fallback
6. Conectar `/despertar` ao fluxo: dispara → chat IA → snooze/wake → propõe sonho → propõe primeiro bloco

## Escopo fora desta fase
- Wake-up real em background com app fechado em iOS (limitação de PWA — só notificação local)
- Geração de música original via AI (usa biblioteca pré-curada por ora; depois ElevenLabs Music)
- Análise profunda de padrões de sono com wearables

---

**Quer que eu implemente já na ordem proposta, ou priorizar primeiro só F.1 + F.2 (alarme + sonhos) e deixar F.3 (jornada do dia) para a próxima rodada?**
