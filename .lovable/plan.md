## REPARAR WIMI-R8 — P0.2-R3 (editorial, read-only)

### 1. Identidade do checkpoint

```yaml
program_id: WIMI-3.7-R8
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_expected: edit/edt-e00150cd-40c2-4798-b166-ee042150cda6
head_at_repair: 82d9ca0139e496180d1f6148a62c684add259dde
validated_execution_head: 82d9ca0139e496180d1f6148a62c684add259dde
obsolete_head_last_reported: be947b5
head_identity_resolution: "HEAD confirmado igual a 82d9ca0; be947b5 descartado"
code_equivalence_with_dependency_checkpoint: true
documental_deltas: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
git_status_before: clean
git_status_after: clean
```
`git diff a4db78b..HEAD -- src supabase package.json bun.lock vite.config.ts tsconfig.json public` vazio → equivalência de código.

### 2. Matriz autocontida (34 unidades × 13 campos)

Legenda de campos por linha: **id · cláusula R8 · classificação · marcadores · evidência · origem · referências · lacuna · reutilização · risco · decisão · camada · status**.

**1 · §2 Contratos e vocabulário canônico** · partial · risk, decision_required · vocabulário de produto existe disperso (missão, quest, hábito, jornada) sem glossário único · file_evidence · `src/lib/missions.ts`, `src/lib/quests.ts`, `src/lib/quest.ts`, `src/lib/journey-agreements.ts` · não há módulo de tipos canônicos nem mapa termo→tabela · alta (nomes já próximos da R8) · médio: divergência semântica entre camadas · qual vocabulário prevalece (R8 vs. atual) · P1.0 · materializado

**2 · §3 Modelo de dados, migrations, RLS, isolamento** · reusable · risk · 85 tabelas, 179 policies, 100% RLS, 54 funções, 45 SECURITY DEFINER, 0 views · current_database_evidence · 87 arquivos em `supabase/migrations/`, `public.has_role`, policies por `auth.uid()` · SECURITY DEFINER não auditadas individualmente · alta · baixo-médio · — · P0.3 / P1.1 · materializado

**3 · §4 Classes epistêmicas e proveniência** · partial · risk, decision_required · `ai_audit_log` registra origem de escrita da IA; demais tabelas não carregam classe epistêmica · current_database_evidence · `ai_audit_log`, `src/lib/ia-capture.ts`, `src/lib/ia-capture-apply.ts` · sem campo `provenance`/`epistemic_class` nas tabelas de domínio · média · médio · onde a proveniência mora (coluna vs. tabela de eventos) · P1.1 · materializado

**4 · §5.1 Execução Basal da Jornada** · partial · risk · `/executar` renderiza timeline, relógio e eventos · file_evidence · `src/routes/_authenticated/executar.tsx`, `src/components/executar/JourneyTimeline.tsx`, `LiveClock.tsx`, `execution_events` · basal não é um ciclo garantido: depende de a tela estar aberta · alta · médio · — · P2.0 · materializado

**5 · §5.1 Três portas de entrada** · partial · risk, decision_required · entradas existentes: Home/Caminhos, `/planejar`, `/assistente` · file_evidence · `src/components/home/panels/CaminhosPanel.tsx`, `src/routes/_authenticated/planejar.tsx`, `assistente.tsx` · portas não são simétricas nem nomeadas conforme R8 · alta · médio · quais três portas são canônicas · P2.1 · materializado

**6 · §5.1 Segmentos e temporalidades** · partial · risk · `scheduled_quests` e `user_missions` têm horário e ordem temporal · current_database_evidence · `scheduled_quests`, `user_missions`, `src/lib/journey-schedule.functions.ts` · sem segmentos nomeados nem duração/janela canônica · média · médio · — · P2.1 / P2.2 · materializado

**7 · §5.2 Grafo, branches e relações** · absent · high_risk, decision_required · nenhuma estrutura de grafo; missões são lista plana · current_database_evidence · `user_missions`, `scheduled_quests` (sem coluna de parent/branch) · não há aresta, branch nem join · baixa · alto: reforma estrutural sem testes · modelo do grafo (tabela de arestas vs. self-reference) · P2.1 · materializado

**8 · §5.2 Três slots operacionais** · absent · high_risk · nenhuma noção de slot no código ou banco · file_evidence + current_database_evidence · grep em `src` e migrations sem ocorrência de slot · ausência total do conceito · baixa · alto · — · P2.1 · materializado

**9 · §5.3 Espera ocupando / liberando slot** · absent · high_risk · sem estado de espera modelado · current_database_evidence · `execution_events` só registra fatos, não estados de espera · falta máquina de estados · baixa · alto · — · P2.2 · materializado

**10 · §8.4 Fila, concorrência, retomada, prioridade** · partial · high_risk, decision_required · append-only real em `execution_events`, `ai_audit_log`, `xp_events`, `brasas_events`; dedup textual local no STT · file_evidence + current_database_evidence · `src/hooks/useSpeechToText.ts:116/230`, `src/routes/api/public/hooks/journey-tick.ts` · não foram encontradas ocorrências de `claim`, `lease` ou `idempotency_key` em `src/` e `supabase/migrations/` (método: grep) · média · alto: ação material repetível em reentrada do cron · onde mora a chave de idempotência e o TTL do lease · P2.2 · materializado (expandido em R2)

**11 · §6 Triggers e sequências** · reusable · decision_required · triggers de gamificação e posts automáticos operacionais · current_database_evidence · triggers de `challenge_checkins`, `xp_events`, `brasas_events` · sem sequência declarativa de jornada · alta · médio · triggers de jornada reaproveitam o mesmo mecanismo? · P1.2 · materializado

**12 · §7.1 Cockpit Executando e Live** · reusable · decision_required · cockpit implementado com relógio vivo e log · file_evidence · `executar.tsx`, `ExecutionLogCard.tsx`, `ManifestPanel.tsx`, `LiveClock.tsx` · Live sem estados honestos completos · alta · baixo · escopo do "Live" canônico · P1.2 · materializado

**13 · §7.2 Lente Planejando** · partial · risk · `/planejar` com extração de blocos de plano · file_evidence · `src/routes/_authenticated/planejar.tsx`, `src/components/planejar/PlanBlocksCard.tsx` · lente não cobre revisão nem versionamento do plano · alta · médio · — · P5.2 · materializado

**14 · §11 Memória (visão de produto)** · partial · decision_required · memória compartilhada mínima em `wimi-memory.ts`; nenhuma tabela `memory_*` · file_evidence + current_database_evidence · `src/lib/wimi-memory.ts`, `chat_settings` · sem camadas nem retenção declarada · média · médio · modelo de persistência da memória · P1.3 · materializado

**15 · §12 Proatividade** · partial · scenographic, risk · nudges e push existem; manifestação depende de tela aberta · file_evidence · `src/lib/mcp/tools/generate-nudges.ts`, `journey_push_schedule`, `JourneyAgent.tsx` · proatividade prometida na UI excede a garantida em background · média · médio-alto · — · P3.1 · materializado

**16 · §12 Bem-estar** · partial · risk · journaling mental e sono existem · file_evidence · `src/routes/_authenticated/mental.tsx`, `dormir.tsx`, `src/lib/mental.ts` · sem indicadores agregados de bem-estar · média · médio · — · P1.3 · materializado

**17 · §14 Gamificação** · reusable · risk · XP, brasas, conquistas, loja e desafios operacionais · current_database_evidence · `xp_events`, `brasas_events`, `shop_items`, `studio_challenges`, `src/lib/achievements.ts` · economia não vinculada à jornada canônica · alta · médio · — · P1.1 · materializado

**18 · §10.1 Dualidade Wi — Tutora / Mi — Mentor** · absent · risk · persona única configurável por gênero de voz · file_evidence · `chat_settings` (`voice_gender`), `src/lib/assistant-name.ts` · não há duas personas nem regra de passagem · baixa · médio-alto · Wi/Mi são personas distintas ou modos · P2.3 · materializado

**19 · §15 Presença, consentimento e retenção** · partial · high_risk, decision_required · RLS forte; 0 tabelas de consentimento · current_database_evidence · policies em `public`, ausência de tabela de consentimento nas 87 migrations · sem expurgo, retenção ou registro de consentimento · média · alto: conformidade · base legal e prazo de retenção · P1.1 + conformidade · materializado

**20 · §10.4 Voz, STT, TTS e identidade vocal** · reusable · risk · TTS pt-BR com gênero e sanitização; STT com dedup · file_evidence · `src/lib/tts-play.ts`, `src/hooks/useSpeechToText.ts`, `src/routes/api/assistant-tts.ts` · identidade vocal não versionada · alta · médio · — · P1.1 · materializado

**21 · §9.1–§9.3 Sensores, câmera, wearables, Wake Lock** · partial · scenographic, risk, decision_required · Wake Lock e câmera pontual existem; wearables é superfície · file_evidence · `src/hooks/useWakeLock.ts`, `src/components/plano/BarcodeScanner.tsx`, `src/routes/_authenticated/wearables.tsx` · promessa da UI acima da captura real · média · médio · quais sensores entram no MVP · P3.1 · materializado

**22 · §9.6 Notificações e background** · partial · high_risk, decision_required · push agendado via cron; `isQuietNow` em `src/lib/push.server.ts` usa `new Date().getHours()` do runtime e ignora o fuso do usuário · file_evidence · `src/lib/push.server.ts:32`, `journey_push_schedule`, `src/routes/api/public/hooks/push-notification.ts` · fuso autoritativo indefinido; PWA limita background · média · alto · fonte autoritativa de fuso e regime de entrega · P2.4 · materializado

**23 · §13.6 Observabilidade** · partial · risk · captura de erro global e log de auditoria · file_evidence · `src/lib/error-capture.ts`, `__root.tsx:122` (`errorComponent`), `ai_audit_log` · sem métricas, tracing ou painel · média · médio · — · P3.2 · materializado

**24 · §15 Testes, rollback e feature flags** · absent · high_risk, decision_required · 0 arquivos de teste; nenhum script `test` em `package.json`; zero ocorrências de feature flag · file_evidence · `package.json`, grep em `src` · sem rede de segurança para reforma estrutural · nenhuma · crítico · runner e escopo mínimo de testes · P0.3 · materializado

**25 · §13.5 Acessibilidade e experiência mobile** · partial · risk · shell mobile-first com `--shell-max` e viewport guard · file_evidence · `src/components/shell/MobileShell.tsx`, `ViewportGuard.tsx`, `src/styles.css` · sem auditoria de contraste, foco e leitor de tela · alta · médio · — · P3.3 · materializado

**26 · §5.2 Modos de alinhamento** · absent · risk, decision_required · nenhuma ocorrência de modo de alinhamento · file_evidence · grep em `src` sem resultado · conceito inexistente · baixa · médio · quantos modos e como comutam · P5.2 · materializado

**27 · §7.4 Transcrição Viva Editável** · partial · decision_required · preview de transcrição em tempo real, editável antes do envio; `interimResults = true` · file_evidence · `src/hooks/useSpeechToText.ts:178`, `assistente.tsx` (janela de 5 linhas) · sem confirmação explícita nem versão persistida da transcrição; "áudio bruto desligado por padrão" (§7.4) não verificado — `ia.tsx:172-177` transmite `audio/webm` ao servidor · média · médio · a transcrição é artefato persistido? · P1.4 · materializado

**28 · §8.2 Níveis graduados de autonomia** · absent · risk, decision_required · nenhuma ocorrência de nível de autonomia · file_evidence · grep em `src` e migrations sem resultado · sem escala nem gate de ação material · baixa · médio · níveis e ações permitidas por nível · P4.0 · materializado

**29 · §9.1–§9.3 Cinco planos independentes / wake word** · absent · high_risk, decision_required · wake simulada por alarme agendado; sem wake word local · file_evidence · `src/hooks/useWakeAlarmScheduler.ts`, `despertar.ringing.tsx` · planos sensoriais não separados; sem Ambient Journal · baixa · alto · quais planos entram e onde roda a wake word · P2.5 · materializado

**30 · §11.1 Camadas de memória L0–L6** · partial · high_risk, decision_required · L1 (sessão) e L6 (perfil) existem de fato; L3–L5 ausentes · current_database_evidence · `chat_settings`, tabelas de perfil; nenhuma tabela `memory_*` · sem consolidação, esquecimento ou hierarquia · média · alto · granularidade e retenção por camada · P6.0 · materializado

**31 · §13.4 Estados honestos por superfície** · partial · decision_required · loading presente (contagem aproximada de 51 ocorrências por grep, não número comprovado de rotas); `navigator.onLine` em um único ponto; zero `retry` em `_authenticated`; 2 rotas com `useQuery` · file_evidence · `src/components/pwa/PWAStatus.tsx:22`, rotas em `src/routes/_authenticated/` · sem estados de erro/retry/vazio padronizados · média · médio · padrão único de estados · P5.0 / P5.1 · materializado

**32 · §15 Segurança funcional e governança** · partial · high_risk, decision_required · RLS 100%, guardrails de IA, webhook com verificação de assinatura · file_evidence + current_database_evidence · `src/lib/ai-guardrails.server.ts`, `src/routes/api/public/hooks/*`, 179 policies · sem governança de expurgo, consentimento nem auditoria das 45 funções SECURITY DEFINER · média · alto · dono da governança e periodicidade da auditoria · P1.1 + conformidade · materializado

**33 · §9.5 Orçamento sensorial** · absent · high_risk, decision_required · grep por `budget|orcamento|sampling|amostragem|framerate|battery|getBattery|thermal|temperatur` em `src` → zero ocorrências · file_evidence · `src/lib/ai-guardrails.server.ts` (rate limit de texto por processo), `ia.tsx:172-177`, `useWakeLock.ts` · sem teto de custo, rede, bateria ou temperatura; "vídeo contínuo não vai ao modelo" é verdadeiro por omissão, não por política · baixa no conceito, média na infraestrutura · alto: drenagem de bateria e custo sem sinal ao usuário · limites globais, por perfil ou por execução; o que ocorre ao exceder · P9.3 · materializado

**34 · §10.5 Estúdios (Presença e Wi/Mi)** · absent · risk, decision_required · existe "Studio" homônimo de outro domínio (gamificação) com ciclo `draft | published | archived` · file_evidence + current_database_evidence · `src/lib/studio.ts:34/41/106`, `src/routes/_authenticated/studio.tsx`, `studio_challenges`, `studio_rewards`; nenhuma tabela de persona/voz/wake phrase nas 87 migrations · sem `testing`/`retired`, preview, A/B, versionamento, auditoria de publicação ou rollback · média (padrão de status + gate por role generalizável) · médio: regressão de identidade irreversível · Estúdio é global ou por usuário; ciclo canônico substitui ou coexiste · P8.0 / P10.0 · materializado

### 3. Contagens

```
reusable  [2,11,12,17,20] = 5
partial   [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32] = 19
incompatible [] = 0
absent    [7,8,9,18,24,26,28,29,33,34] = 10
5 + 19 + 0 + 10 = 34 OK
scenographic [15,21]; high_risks [7,8,9,10,19,22,24,29,30,32,33]; risk_annotations_total 34
```

### 4. Reconciliação das decisões

`18 + 6 adicionadas - 2 removidas = 22`. A unidade 10 **não** integrava as 18 decisões de R1; a expansão à literalidade de §8.4 introduziu decisão sobre o modelo de concorrência — a frase "+10 já contava" é incorreta e fica retificada. As remoções (23, 25) e inclusões (24, 32) são remanejamento de marcadores com efeito líquido zero; nenhuma alteração é apresentada como simples ajuste de total.

### 5. Mapeamentos de camada corrigidos

`7:P2.1 8:P2.1 9:P2.2 10:P2.2 11:P1.2 12:P1.2 14:P1.3 15:P3.1 16:P1.3 17:P1.1 18:P2.3 20:P1.1 21:P3.1 22:P2.4 23:P3.2 25:P3.3 27:P1.4 29:P2.5` → `future_layer_mapping_corrections: 18` (a unidade 10 entra na contagem, sem campo separado).

### 6. Status das cláusulas

§8.4 coberta pela expansão da unidade 10; §9.5 pela unidade 33; §10.5 pela unidade 34; §9.6 transversal (unidades 22, 29, 33), sem eixo próprio; §16–§20 meta-programa, fora da matriz. `remaining_coverage_gaps: []`.

### 7. Pacote de Retorno

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R3
repair_type: editorial_self_containment
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch: edit/edt-e00150cd-40c2-4798-b166-ee042150cda6
head_at_repair: 82d9ca0139e496180d1f6148a62c684add259dde
validated_execution_head_from_r2: 82d9ca0139e496180d1f6148a62c684add259dde
obsolete_head_last_reported: be947b5
head_identity_resolution: "HEAD confirmado = 82d9ca0; referência be947b5 substituída; nenhuma operação Git executada"
code_equivalence_confirmed: true
documental_deltas: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
coverage_units_total: 34
matrix_fields_per_unit: 13
matrix_self_contained: true
units_materialized: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
units_referenced_only: []
reusable: [2,11,12,17,20]
partial: [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32]
incompatible: []
absent: [7,8,9,18,24,26,28,29,33,34]
classification_sum_check: "5 + 19 + 0 + 10 = 34 OK"
scenographic: [15,21]
high_risks: [7,8,9,10,19,22,24,29,30,32,33]
risk_annotations_total: 34
decision_ids_r1: [1,3,5,7,11,12,14,18,19,21,23,25,26,27,28,29,30,31]
decision_ids_added_r2: [10,22,24,32,33,34]
decision_ids_removed_r2: [23,25]
decision_ids_final: [1,3,5,7,10,11,12,14,18,19,21,22,24,26,27,28,29,30,31,32,33,34]
decisions_required: 22
decision_count_resolution: "18 + 6 - 2 = 22; unidade 10 é decisão nova por §8.4; '+10 já contava' retificado; 23/25 saem e 24/32 entram como remanejamento de marcadores"
future_layer_mapping_corrected_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,25,27,29]
future_layer_mapping_corrections: 18
future_layer_mapping_resolution: "unidade 10 contabilizada na correção; valor 17 descartado"
clause_8_4_treatment: "coberta pela expansão da unidade 10"
clause_9_5_treatment: "coberta pela unidade suplementar 33"
clause_10_5_treatment: "coberta pela unidade suplementar 34"
clause_9_6_treatment: "transversal às unidades 22, 29 e 33; sem eixo próprio"
clauses_16_20_treatment: "meta-programa; fora da matriz de aderência"
remaining_coverage_gaps: []
evidence_corrections:
  - "claim/lease/idempotency_key: zero ocorrências por grep em src/ e supabase/migrations/"
  - "isQuietNow (push.server.ts:32) usa new Date().getHours() do runtime e ignora o fuso do usuário"
  - "85 tabelas, 179 policies, 54 funções, 45 SECURITY DEFINER, 0 views: estado atual do banco, não snapshot de a4db78b"
  - "51 linhas de loading: contagem aproximada por grep, não número comprovado de rotas"
remaining_evidence_gaps:
  - "ausência de storage de áudio verificada por grep, não por inspeção de buckets"
  - "build, typecheck e lint não executados (P0.3)"
  - "45 funções SECURITY DEFINER não auditadas individualmente"
  - "runtime não observado: idempotência, latência, bateria, temperatura, custo de IA"
canonical_documents_read:
  - WIMI_v3_7_R8_Instrucoes_Canonicas_para_Lovable.md
  - WIMI_v3_7_R8_Documento_Unificado_para_Lovable.md
  - WIMI_v3_7_R8_Prompts_Sequenciais_de_Execucao.md
  - .lovable/wimi-r8-checkpoint.md
document_persistence_gate: pending
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
  - "validar a matriz materializada P0.2-R3"
  - "resolver posteriormente o gate de persistência documental"
  - "resolver posteriormente o gate de segurança pré-P2"
recommended_next_command: "VALIDAR WIMI-R8 — P0.2-R3"
```

### Fora do escopo
P0.2 não aprovado. P0.3 não iniciado. Nenhum arquivo criado ou alterado.
