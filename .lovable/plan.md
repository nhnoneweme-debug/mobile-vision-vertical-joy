## REPARAR WIMI-R8 — P0.2-R4 (somente leitura)

Fontes obrigatórias verificadas e integralmente acessíveis nesta rodada: `WIMI_v3_7_R8_Instrucoes_Canonicas_para_Lovable.md` (186 linhas), `WIMI_v3_7_R8_Documento_Unificado_para_Lovable.md` (959 linhas), `WIMI_v3_7_R8_Prompts_Sequenciais_de_Execucao.md` (799 linhas), `.lovable/wimi-r8-checkpoint.md`, `.lovable/plan.md` (validação P0.2-R3). **nenhuma operação Git mutativa executada.**

### 0. Identidade Git efetiva

| Campo | Valor |
|---|---|
| branch_inspected_at_r4 | `edit/edt-7356c809-a9d6-44cd-a096-a2cd2f8d35fe` |
| head_inspected_at_r4 | `ad1db214f7b2c79c7eae4800ec19f6dac7f58842` |
| head_last_validated | `2a4269401bc407ca408c367c96d3c0721ad126f1` |
| dependency_checkpoint_sha | `a4db78bde11018d44c3be0ae8507b661acae9a06` |
| git_status_before / after | clean / clean |
| deltas P0.1→HEAD | `M .lovable/plan.md`, `A .lovable/wimi-r8-checkpoint.md` (preexistentes) |
| diff em `src supabase package.json bun.lock vite.config.ts tsconfig.json public` | vazio → `code_equivalence_confirmed: true` |

Branch e HEAD mudaram novamente desde o R3; identidade tratada como volátil, equivalência de código intacta.

### 1. Matriz autocontida — 34 unidades, 13 campos

Campos: **(1)** ID · **(2)** cláusula · **(3)** classificação · **(4)** marcadores · **(5)** evidência · **(6)** origem da evidência · **(7)** artefatos · **(8)** lacuna · **(9)** reutilização · **(10)** risco · **(11)** decisão de operador · **(12)** camada futura canônica · **(13)** status formal do reparo (baseline P0.2-R1).

**1** · §2 Vocabulário canônico · parcial · risco · nomes do código (`missions`, `quests`, `habits`, `journey`) não mapeiam Executando/Planejando/Live/Wi/Mi · file_evidence · `src/lib/missions.ts`, `quests.ts`, `journey-*`, 87 migrations · sem enums/tipos centralizados do vocabulário R8 · alto: schema estável reaproveitável por aliases · renomeação ampla quebra rotas e dados · decisão: aprovar estratégia aditiva por alias+adaptador em vez de renomear tabelas · **P1.0 — Vocabulário e contratos canônicos** · preserved

**2** · Modelo de dados e RLS · reutilizável · — · 85 tabelas em `public`, 100% com RLS, 179 policies · current_database_evidence · `supabase/migrations/*` · nenhuma para a fundação; falta envelope append-only · integral · baixo · não requer decisão · P1.1 (consolidação) · preserved

**3** · Classes epistêmicas e proveniência · parcial · risco · registros não distinguem fato/relato/observação/inferência/hipótese · file_evidence · `execution_events`, `ai_audit_log` · ausência de coluna de classe epistêmica e `trace_id` · parcial (eventos já append-only) · médio: histórico sem classe não é reclassificável retroativamente · decisão: definir classe default para o histórico já gravado (`unknown` vs backfill heurístico) · P1.1 — Envelope de eventos, proveniência e RLS · preserved

**4** · Execução Basal da Jornada · parcial · — · `/executar` opera sobre `user_missions` e `scheduled_quests`, sem jornada basal única por escopo · file_evidence · `src/routes/_authenticated/executar.tsx`, `execution_sessions` · não há `journey_execution` basal sem consumo de slot · alta (telemetria existe) · médio · não requer decisão nova · P2.0 — Execução Basal da Jornada · preserved

**5** · Três portas de entrada · parcial · — · existem plano e começar-agora; intenção livre não é porta de igual hierarquia · file_evidence · `PlanBlocksCard.tsx`, `execute-intent.ts` · origem emergente não é imutável · alta · médio · decisão: definir se "intenção" vira porta autônoma ou variação de one_off · P2.1 — Três portas e segmentos · preserved

**6** · Temporalidades (pretendido/ocorrido/interpretado) · parcial · — · há `scheduled_time` e timestamps de evento; não há tempo interpretado · file_evidence · `scheduled_quests`, `execution_events` · separação incompleta · média · médio · não requer decisão nova · P2.2 — Grafo, branches e temporalidades · preserved

**7** · Grafo, branches e joins · ausente · high_risk · nenhuma tabela de nós/relações; grep sem `branch`, `join`, `depends_on` · file_evidence · — · fundação inexistente · nenhuma · alto: reescrita do modelo de execução · decisão: adotar grafo genérico único ou tabelas por modo (`timeline`/`event_flow`/`hybrid`) · **P2.2 — Grafo, branches e temporalidades** · corrected (mapeamento)

**8** · Slots operacionais (máx. 3 running) · ausente · high_risk · não há limite transacional de execuções simultâneas · file_evidence · `execution_sessions` sem constraint · falta controle transacional e escolha na 4ª tentativa · nenhuma · alto: corrida cria 4º slot · decisão: onde impor o limite (constraint parcial vs função com lock) · **P3.0 — Três slots, foco e foreground** · corrected (mapeamento)

**9** · Mecanismo de espera (duas formas) · ausente · high_risk · não existem `waiting_external` nem `status=waiting` · file_evidence · — · nenhuma espera modelada · nenhuma · alto · decisão: política default ao estacionar (libera slot sempre?) · **P3.1 — Duas esperas** · corrected (mapeamento)

**10** · §8.4 Fila, concorrência, claim/lease e idempotência · parcial · high_risk, insufficient_evidence · cron `journey-tick` processa fila sem claim/lease; grep sem `lease`/`idempotency_key` (ocorrências de `claims` são JWT em `auth-middleware.ts`) · file_evidence + inference · `src/routes/api/public/hooks/journey-tick.ts`, `journey_push_schedule` · sem claim transacional, lease com TTL, retry limitado, deduplicação, expiração e reordenação append-only · parcial (fila existe) · alto: ação material repetida silenciosamente · decisão: onde mora a chave de idempotência (coluna `client_event_id` única vs tabela de dedupe) e qual TTL de lease · **P4.1 — Sequência, fila e concorrência** (pré-requisito **P3.2 — Retomada e fila**) · expanded

**11** · Triggers e sequências · reutilizável · — · triggers Postgres e cron hooks funcionando · current_database_evidence · 54 funções, 45 SECURITY DEFINER, `journey-tick`, `generate-nudges` · falta genealogia (origem, autoria, confiança) · alta · médio · decisão: exigir origem obrigatória em trigger autônomo desde P4.0 · **P4.0 — Genealogia de triggers** · corrected (mapeamento)

**12** · Cockpit Executando · reutilizável · — · `/executar` com relógio vivo, timeline, log e manifestação · file_evidence · `LiveClock.tsx`, `JourneyTimeline.tsx`, `ExecutionLogCard.tsx`, `ManifestPanel.tsx` · falta card com slot/espera/fila/grafo · alta · baixo · decisão: preservar layout atual como base do Cockpit R8 · **P5.0 — Cockpit da Jornada** (compartilhada com **P5.1 — Execução objetiva**) · corrected (mapeamento)

**13** · Lente Planejando · parcial · — · `/planejar` gera blocos e envia para execução · file_evidence · `src/routes/_authenticated/planejar.tsx`, `PlanBlocksCard.tsx` · sem snapshot, fatos/desconhecidos, custo, valor e diff · alta · médio · não requer decisão nova · P5.2 — Planejando, alinhamento e comparação · preserved

**14** · Memória · parcial · — · `wimi-memory.ts` monta SharedContext em runtime, sem persistência governada · file_evidence · `src/lib/wimi-memory.ts` · sem fonte/confiança/validade/retenção/contestação nem `memory_retrieval_trace` · média · médio · decisão: recuperação determinística no MVP, embeddings adiados · **P6.0 — Memória transparente** · corrected (mapeamento)

**15** · Proatividade · parcial · cenográfico, risco · nudges gerados por RPC, sem cooldown/recusa/custo · file_evidence · `generate_my_nudges`, `generate-nudges` hook · sem separação candidata × manifestação entregue · média · médio: insistência percebida · decisão: política default de cooldown e supressão após recusa · **P7.1 — Proatividade governada** · corrected (mapeamento)

**16** · Bem-estar transversal · parcial · — · sono, dieta, treino e mental existem como áreas isoladas · file_evidence · `mental.ts`, `cozinha.ts`, `treino.functions.ts` · sem origem declarada (relato/dispositivo/observação/inferência) · alta · médio: diagnóstico implícito · não requer decisão nova · **P6.1 — Bem-estar transversal** · corrected (mapeamento)

**17** · Gamificação · reutilizável · — · XP, níveis, conquistas, brasas e loja operantes · file_evidence · `achievements.ts`, `shop.ts`, `crystals.ts`, `perks.ts` · progressão não é recalculável a partir de eventos · alta · baixo · decisão: manter economia atual e derivá-la de eventos verificáveis · **P6.2 — Gamificação reconciliada** · corrected (mapeamento)

**18** · Dualidade Wi/Mi · ausente · — · assistente único, sem `speaker` por segmento · file_evidence · `assistant.functions.ts`, `api/assistant.ts` · sem postura Tutora/Mentor nem função/razão por segmento · parcial (prompt central existe) · médio · decisão: Wi/Mi como posturas do mesmo kernel (não dois agentes) · **P7.0 — Kernel Wi/Mi** · corrected (mapeamento)

**19** · Consentimento e retenção · parcial · high_risk · RLS forte, mas sem tabelas de consentimento nem política de expurgo · current_database_evidence · 179 policies; nenhuma tabela `consent*`/`retention*` · retenção e revogação inexistentes · parcial · alto: dado sensível sem prazo · decisão: prazo de retenção por classe de dado e responsável pelo expurgo · P1.1 / P9.2 · preserved

**20** · Voz e TTS · reutilizável · — · TTS pt-BR com gênero, sanitização e antisobreposição · file_evidence · `tts-play.ts`, `api/assistant-tts.ts`, `voice_gender` · sem desacoplamento `speaker`×conteúdo×perfil · alta · baixo · decisão: manter provedor atual no estudo técnico · **P10.1 — Duas vozes** (pré-requisito **P10.0 — Estudo técnico**) · corrected (mapeamento)

**21** · Sensores e presença · parcial · cenográfico, insufficient_evidence · microfone e câmera usados sob ação explícita; sem perfis de presença versionados · file_evidence · `useSpeechToText.ts`, `BarcodeScanner.tsx`, `ia.tsx` · sem `Manual Only`/`Ambient Wake`/`Ambient Journal`/`Session Lab`/`Custom` · parcial · médio · decisão: perfis permanecem simulados até autorização explícita de sensores · **P8.0 — Perfis e Estúdio de Presença** (real somente em **P9.0 — Wake word local**) · corrected (mapeamento)

**22** · Notificações e quiet hours · parcial · high_risk · `isQuietNow` usa `new Date().getHours()` do runtime do servidor · file_evidence · `src/lib/push.server.ts`, `push.functions.ts` · fuso do usuário ignorado · alta · alto: notificação em horário indevido · decisão: fonte autoritativa de fuso (coluna no perfil vs header do cliente por requisição) · **P7.1 — Proatividade governada** (responsabilidade compartilhada com P8.0 para canais) · corrected (evidência e mapeamento)

**23** · Observabilidade · parcial · — · captura de erro no cliente; sem métricas/tracing de servidor · file_evidence · `error-capture.ts`, `lovable-error-reporting.ts` · sem `trace_id` ponta a ponta nem métricas de fila/custo · parcial · médio · decisão: escolher stack e contrato de métricas, tracing e observabilidade · **no_dedicated_layer** — responsabilidade resolvida em **PF.1 — Aceite integrado** e verificada em **PF.2 — Publicação controlada** ("verifique versão, migrations, smoke tests, observabilidade, feature flags e rollback") · corrected (mapeamento)

**24** · Testes, feature flags e rollback · ausente · high_risk · 0 arquivos `*.test.*`/`*.spec.*`, sem script `test` · file_evidence · `package.json` · nenhuma rede de segurança para reforma estrutural · nenhuma · alto: bloqueante antes de P2.0 · decisão: escolher runner e escopo mínimo (RLS + idempotência + rota crítica) · P0.3 (plano) → gate bloqueante antes de **P2.0 — Execução Basal da Jornada** · corrected (decisão adicionada)

**25** · Acessibilidade · parcial · — · shadcn/Radix fornece base ARIA; sem critérios verificáveis · file_evidence · `src/components/ui/*` · sem alvo WCAG declarado nem verificação de teclado/leitor de tela · parcial · médio · decisão: nível-alvo (AA) e critérios verificáveis de aceite · **no_dedicated_layer** — responsabilidade resolvida dentro de **P5.0 — Cockpit da Jornada** ("inclua mobile, teclado, leitor de tela, vazio, loading e erro") e revalidada em **PF.1 — Aceite integrado** · corrected (mapeamento)

**26** · §5.2 Modos de alinhamento · ausente · — · sem `plan_faithful`/`adaptive_balance`/`execution_discovery` · file_evidence · grep sem ocorrências · comparação intenção×realização inexistente · nenhuma · médio · decisão: modo default de alinhamento para usuários existentes · P5.2 — Planejando, alinhamento e comparação · preserved

**27** · §7.4 Transcrição Viva editável · parcial · insufficient_evidence · transcrição em tempo real existe; edição não é canônica nem consolidada · file_evidence · `useSpeechToText.ts`, `assistente.tsx` · sem estados separados captar/interpretar/persistir/manifestar · alta · médio · decisão: correção humana sobrescreve ou versiona o segmento original · **P9.1 — Transcrição Viva** · corrected (evidência e mapeamento)

**28** · §8.2 Níveis graduados de autonomia · ausente · — · não há gradação de autonomia da IA · file_evidence · `ai-guardrails.server.ts` (só rate limit e antinjeção) · sem escada sugerir→confirmar→agir · nenhuma · médio · decisão: nível máximo permitido no MVP · P8.0 / P7.1 · preserved

**29** · §9.1–§9.3 Cinco planos independentes e ambient · ausente · high_risk · nenhuma sessão ambiente, roster de consentimento ou retenção por sessão · file_evidence · — · piloto inexistente · nenhuma · alto: privacidade de terceiros · decisão: autorizar ou adiar o piloto ambiente e definir participantes elegíveis · **P9.2 — Ambient Journal** (pré-requisitos **P8.0** e **P8.1 — Wake phrases simuladas**) · corrected (evidência e mapeamento)

**30** · §11.1 Camadas de memória L0–L6 · parcial · high_risk · L1 (mensagens) e L6 (perfil) existem; L3–L5 ausentes · file_evidence · tabelas de chat, `profiles` · sem consolidação por camada nem expiração · parcial · alto · decisão: quais camadas entram no MVP · P6.0 — Memória transparente · preserved

**31** · §13.4 Estados honestos por superfície · parcial · — · loading e vazio presentes; retry explícito ausente · inference (métrica de grep) · rotas em `src/routes/_authenticated/*` · sem contrato uniforme de erro/offline/retry · alta · médio · decisão: componente único de estado ou contrato por rota · P5.0 — Cockpit da Jornada · preserved

**32** · §15 Segurança funcional e governança · parcial · high_risk · RLS 100%, 45 funções SECURITY DEFINER não auditadas individualmente · current_database_evidence · `supabase/migrations/*` · sem revisão periódica nem inventário de privilégio · alta · alto: escalonamento silencioso · decisão: dono da governança e periodicidade da auditoria das funções SECURITY DEFINER · P0.4 (congelamento) + PF.1 · corrected (decisão adicionada)

**33** · §9.5 Orçamento sensorial · ausente · high_risk, insufficient_evidence · nenhuma medição de custo, rede, bateria ou temperatura; sem teto configurável · file_evidence + insufficient_evidence (runtime não observado) · — · orçamento e comportamento ao exceder inexistentes · nenhuma · alto: custo de IA e bateria sem limite · decisão: tetos de custo/bateria e comportamento ao exceder (degradar, pausar, avisar) · **P9.3 — Imagem e movimento** — literal: "Meça custo, rede, bateria e temperatura… Não envie vídeo contínuo ao modelo" · added

**34** · §10.5 Estúdio de Presença e Estúdio Wi/Mi · ausente · — · `/studio` existente é de gamificação, homônimo e não relacionado · file_evidence · `src/routes/_authenticated/studio.tsx`, `src/lib/studio.ts` · sem ciclo `draft`/`testing`/`published`/`retired` para personas e vozes · nenhuma (homonímia) · médio: confusão de nome · decisão: escopo (global vs por usuário) e ciclo canônico dos Estúdios; renomear ou não a rota existente · **P8.0 — Perfis e Estúdio de Presença** (configuração versionada e preview) + **P10.3 — Estúdios integrados** (voz, versões e rollback) · added

### 2. Status formal — partição sem sobreposição

- **preserved (12):** 1, 2, 3, 4, 5, 6, 13, 19, 26, 28, 30, 31
- **expanded (1):** 10
- **added (2):** 33, 34
- **corrected (19):** 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 27, 29, 32

União = 1–34; interseções vazias; total 12 + 1 + 2 + 19 = **34**. As unidades 26–32 não são `added` (já eram as sete `supplemental_units_r1`); 27 e 29 são `corrected` por evidência/mapeamento; 28, 30, 31 permanecem `preserved`.

### 3. Classificações e riscos

`reusable [2,11,12,17,20]` = 5 · `partial [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32]` = 19 · `incompatible []` = 0 · `absent [7,8,9,18,24,26,28,29,33,34]` = 10 → **5 + 19 + 0 + 10 = 34**. Nenhuma classificação foi alterada por insuficiência de evidência transversal; `units_with_insufficient_evidence: [10,21,27,33]` registrado à parte. `risk_annotations_total: 34` (coluna de risco preenchida em todas) é distinto de `transversal_high_risk_marker_total: 11` ([7,8,9,10,19,22,24,29,30,32,33]); `scenographic: [15,21]`.

### 4. Mapeamentos — R2 versus R3

Os **18** IDs de mapeamento futuro estão integralmente resolvidos contra os Prompts Sequenciais: **16** com camada dedicada ou compartilhada ([7,8,9,10,11,12,14,15,16,17,18,20,21,22,27,29]) e **2** com `no_dedicated_layer` semanticamente resolvido por gate e responsabilidade citados ([23] → PF.1/PF.2; [25] → P5.0 + PF.1). `no_dedicated_layer` **não** é lacuna: é destino canônico legítimo, portanto `remaining_mapping_gaps: []` e `future_layer_mapping_corrections: 18`.

Divergência R2×R3: ambos apontavam 33→P9.3 (confirmado literalmente) e 34→"P8.0/P10.0"; **P10.0 — Estudo técnico** não hospeda estúdio algum, logo o destino correto de 34 é **P8.0 + P10.3 — Estúdios integrados**. Nenhum outro conflito material entre os dois mapas subsiste: as divergências restantes eram rótulos genéricos, agora substituídos por identificador e título literais.

### 5. Evidências qualificadas

- **Loading:** 51 linhas sob o padrão anterior e 77 sob outro padrão de grep; resultados **não comparáveis**, métrica aproximada e frágil, e **não** representa contagem de rotas.
- **Áudio:** MediaRecorder captura e transmite `audio/webm` (`ia.tsx`); persistência de áudio bruto em storage **não comprovada**; ausência em grep ≠ inspeção de buckets; "áudio bruto desligado por padrão" permanece **não verificado**.
- **Banco (estado atual, não snapshot do SHA de P0.1):** 85 tabelas, 179 policies, 54 funções, 45 SECURITY DEFINER, 0 views, 100% RLS.
- **Lacunas preservadas:** buckets de storage não inspecionados; runtime de idempotência, latência, bateria, temperatura e custo não observado; 45 funções SECURITY DEFINER não auditadas individualmente; build, lint e typecheck reservados a P0.3.

### 6. Gates registrados (não executados)

Persistência dos três documentos R8 no repositório antes de P1.0 (a leitura dos anexos nesta rodada **não** satisfaz esse gate); P0.3 estritamente read-only; build, lint e typecheck somente em P0.3; testes mínimos, feature flags e rollback como gate bloqueante antes de P2.0; congelamento da auditoria em P0.4.

### 7. Pacote de Retorno

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R4
repair_attempt: 4
result: revised
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_inspected_at_r4: edit/edt-7356c809-a9d6-44cd-a096-a2cd2f8d35fe
head_last_validated: 2a4269401bc407ca408c367c96d3c0721ad126f1
head_inspected_at_r4: ad1db214f7b2c79c7eae4800ec19f6dac7f58842
code_equivalence_confirmed: true
documental_deltas: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
matrix_self_contained: true
coverage_units_total: 34
matrix_fields_per_unit: 13
unit_ids_complete_and_unique: true
repair_status_baseline: P0.2-R1
repair_status_precedence: [added, expanded, corrected, preserved]
units_preserved: [1,2,3,4,5,6,13,19,26,28,30,31]
units_expanded: [10]
units_added: [33,34]
units_corrected: [7,8,9,11,12,14,15,16,17,18,20,21,22,23,24,25,27,29,32]
repair_status_partition_check: "12 + 1 + 2 + 19 = 34; intersecoes vazias; uniao = 1..34"
reusable: [2,11,12,17,20]
partial: [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32]
incompatible: []
absent: [7,8,9,18,24,26,28,29,33,34]
classification_sum_check: "5 + 19 + 0 + 10 = 34"
units_with_insufficient_evidence: [10,21,27,33]
scenographic: [15,21]
risk_annotation_definition: non_empty_risk_column
risk_annotation_item_ids: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
risk_annotations_total: 34
transversal_high_risk_marker_ids: [7,8,9,10,19,22,24,29,30,32,33]
transversal_high_risk_marker_total: 11
decision_ids_r1: [1,3,5,7,11,12,14,18,19,21,23,25,26,27,28,29,30,31]
decision_ids_added: [10,22,24,32,33,34]
decision_ids_removed: []
decision_ids_final: [1,3,5,7,10,11,12,14,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
decisions_required: 24
decision_count_resolution: "18 + 6 = 24"
future_layer_mapping_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,25,27,29]
future_layer_mapping_ids_total: 18
dedicated_or_shared_layer_mapping_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,27,29]
dedicated_or_shared_layer_mapping_total: 16
no_dedicated_layer_ids: [23,25]
no_dedicated_layer_total: 2
future_layer_mapping_resolved_total: 18
future_layer_mapping_destinations:
  7: "P2.2 — Grafo, branches e temporalidades"
  8: "P3.0 — Tres slots, foco e foreground"
  9: "P3.1 — Duas esperas"
  10: "P4.1 — Sequencia, fila e concorrencia (pre-req P3.2 — Retomada e fila)"
  11: "P4.0 — Genealogia de triggers"
  12: "P5.0 — Cockpit da Jornada (compartilhada com P5.1 — Execucao objetiva)"
  14: "P6.0 — Memoria transparente"
  15: "P7.1 — Proatividade governada"
  16: "P6.1 — Bem-estar transversal"
  17: "P6.2 — Gamificacao reconciliada"
  18: "P7.0 — Kernel Wi/Mi"
  20: "P10.1 — Duas vozes (pre-req P10.0 — Estudo tecnico)"
  21: "P8.0 — Perfis e Estudio de Presenca (real somente em P9.0 — Wake word local)"
  22: "P7.1 — Proatividade governada (compartilhada com P8.0 para canais)"
  23: "no_dedicated_layer — resolvido em PF.1 — Aceite integrado e PF.2 — Publicacao controlada"
  25: "no_dedicated_layer — resolvido em P5.0 — Cockpit da Jornada e revalidado em PF.1"
  27: "P9.1 — Transcricao Viva"
  29: "P9.2 — Ambient Journal (pre-req P8.0 e P8.1 — Wake phrases simuladas)"
future_layer_mapping_corrections: 18
r2_vs_r3_mapping_resolution: "18 destinos resolvidos: 16 com camada dedicada ou compartilhada e 2 como no_dedicated_layer com gate citado; 33 confirmado em P9.3; 34 corrigido de P8.0/P10.0 para P8.0 + P10.3 — Estudios integrados"
unit_10_mapping: "P4.1 — Sequencia, fila e concorrencia (claim, lease, retry limitado, deduplicacao, expiracao)"
unit_33_mapping: "P9.3 — Imagem e movimento"
unit_34_mapping: "P8.0 — Perfis e Estudio de Presenca + P10.3 — Estudios integrados"
canonical_layer_titles_verified: true
remaining_mapping_gaps: []
remaining_coverage_gaps: []
evidence_corrections:
  - "branch e HEAD atualizados: edit/edt-7356c809... @ ad1db214"
  - "loading: 51 linhas sob padrao anterior e 77 sob outro padrao; nao comparaveis; nao equivale a rotas"
  - "audio: captura e transmissao comprovadas; persistencia em storage nao comprovada"
  - "34 = campos de risco preenchidos; 11 = marcadores transversais high_risk"
  - "34 mapeado para P8.0 + P10.3, nao P10.0"
  - "no_dedicated_layer (23, 25) e destino resolvido, nao lacuna"
remaining_evidence_gaps:
  - "buckets de storage nao inspecionados"
  - "runtime nao observado: idempotencia, latencia, bateria, temperatura, custo"
  - "45 funcoes SECURITY DEFINER nao auditadas individualmente"
  - "build, lint e typecheck reservados a P0.3"
document_persistence_gate: pending_before_P1.0
pre_p2_safety_gate: pending
files_created: []
files_changed: []
code_changed: false
database_changed: false
git_status_before: clean
git_status_after: clean
no_mutative_commands_executed: true
no_changes_made: true
ready_for_validation: true
ready_for_approval: false
ready_for_next_layer: false
operator_decision_required:
  - "validar o reparo editorial P0.2-R4"
  - "decidir persistencia dos tres documentos R8 antes de P1.0"
recommended_next_command: "VALIDAR WIMI-R8 — P0.2-R4"
```

P0.2 não aprovado. P0.3 não iniciado.
