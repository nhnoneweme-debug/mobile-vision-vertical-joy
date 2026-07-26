## REPARAR WIMI-R8 — P0.2 (tentativa 1)

Operação estritamente em leitura. `git status --porcelain` vazio antes e depois; HEAD inspecionado `c8b56b2`. Nenhum arquivo criado ou alterado; documentos R8 lidos apenas do mount de upload e não persistidos no repositório.

### Estrutura da matriz revisada

- **Eixos 1–25:** eixos-base derivados da enumeração do comando P0.2 (preservados, com a errata aplicada).
- **Unidades 26–32:** unidades suplementares de cobertura canônica, ancoradas em cláusula literal do Documento Unificado R8.
- **Marcadores transversais:** `cenográfico`, `risco`, `high_risk` e `decisão necessária` — não somam às 32 unidades.

---

### Bloco A — eixos-base 1–25 (classificação preservada, errata aplicada)

| # | Requisito | Classificação | Marcadores | Camada |
|---|---|---|---|---|
| 1 | Contratos e vocabulário canônico | parcial | risco médio · decisão | P1 |
| 2 | Modelo de dados, migrations, RLS, isolamento | **reutilizável** | risco baixo-médio | P0.3/P1 |
| 3 | Classes epistêmicas e proveniência | parcial | **high_risk** · decisão | P1 |
| 4 | Execução Basal da Jornada | parcial | risco médio | P2 |
| 5 | Três portas de entrada | parcial | risco médio · decisão | P2 |
| 6 | Segmentos e temporalidades | parcial | risco médio | P2 |
| 7 | Grafo, branches e relações | **ausente** | **high_risk** · decisão | P1+P2 |
| 8 | Três slots operacionais | **ausente** | **high_risk** | P1/P2 |
| 9 | Espera ocupando / liberando slot | **ausente** | **high_risk** | P2 |
| 10 | Retomadas, filas e prioridades | parcial | risco médio | P2 |
| 11 | Triggers e sequências | **reutilizável** | risco médio · decisão | P2 |
| 12 | Cockpit Executando e Live | **reutilizável** | risco baixo · decisão | P3 |
| 13 | Lente Planejando | parcial | risco médio | P2/P3 |
| 14 | Memória (visão de produto) | parcial | **high_risk** · decisão | P3 |
| 15 | Proatividade | parcial | risco médio-alto | P3 |
| 16 | Bem-estar | parcial | risco médio | P3 |
| 17 | Gamificação | **reutilizável** | risco médio | P4 |
| 18 | Dualidade Wi — Tutora / Mi — Mentor | **ausente** | risco médio-alto · decisão | P3 |
| 19 | Presença, consentimento e retenção | parcial | **high_risk** · decisão | P1+P5 |
| 20 | Voz, STT, TTS e identidade vocal | **reutilizável** | risco médio | P3 |
| 21 | Sensores, câmera, wearables, Wake Lock | parcial | **cenográfico** · risco médio · decisão | P4 |
| 22 | Notificações e background | parcial | **high_risk** · decisão | P3 |
| 23 | Observabilidade | parcial | **high_risk** | P5 |
| 24 | Testes, rollback e feature flags | **ausente** | **high_risk (crítico)** · decisão | P0.3 |
| 25 | Acessibilidade e experiência mobile | parcial | risco médio | P5 |

**Errata aplicada:** a síntese anterior escrevia “reutilizável 4” e enumerava cinco itens. O valor correto é **5** — eixos 2, 11, 12, 17 e 20.

---

### Bloco B — unidades suplementares 26–32

#### 26 — §5.2 Modos de alinhamento
- **Cláusula R8:** `plan_faithful`, `adaptive_balance` (padrão), `execution_discovery`; nenhum modo transforma divergência em falha moral.
- **Classificação:** ausente
- **Marcadores:** risco médio · decisão necessária
- **Evidência (a):** `grep -rin "plan_faithful\|adaptive_balance\|execution_discovery\|alignment" src supabase/migrations` → zero ocorrências.
- **Símbolos correlatos:** `src/lib/planning.ts`, `src/lib/wimi-memory.ts` (`seedForFramework` fixa um único tom de planejamento), `src/components/planejar/PlanBlocksCard.tsx`.
- **Lacuna:** não existe eixo de alinhamento plano↔execução; divergência entre `user_missions.scheduled_time` e execução real não é interpretada por política.
- **Reutilização:** média — `chat_settings` é o local natural para persistir o modo; o seed já é parametrizável por framework.
- **Risco:** médio — sem o modo, o tom da WiMi é único e pode ler desvio como falha, contrariando a constituição §3.5.
- **Decisão necessária:** modo por usuário, por jornada ou por execução.
- **Camada responsável:** P5.2 (Planejando, alinhamento e comparação).

#### 27 — §7.4 Transcrição Viva Editável
- **Cláusula R8:** palavras durante a fala, texto provisório editável, correção humana prevalece, baixa confiança indicada, texto confirmado é canônico, edição posterior cria revisão quando já houve efeito, mic desligado não apaga texto confirmado, áudio bruto desligado por padrão.
- **Classificação:** parcial
- **Marcadores:** risco médio · decisão necessária
- **Evidência (a):** `src/hooks/useSpeechToText.ts` — `interim` (l.107), `interimResults = true` (l.178), dedup por `finalResultKeysRef` (l.116/230), `preview` de 5 linhas (l.321-322), religa via `onend`; `src/lib/tts-play.ts` com `sanitizeForTts`. Áudio bruto não é persistido em nenhuma tabela (nenhum bucket de áudio em uso).
- **Lacuna:** o texto transcrito é rascunho de composer, não registro canônico versionado. Não há indicação de confiança, não há revisão pós-efeito, e o texto confirmado não sobrevive a fechar a tela.
- **Reutilização:** alta — o pipeline de captura e dedup já atende metade da cláusula.
- **Risco:** médio — correção humana pode ser perdida silenciosamente; conflita com §3.16 (texto revisado é canônico).
- **Decisão necessária:** onde persistir o texto confirmado e como representar revisão com efeito já produzido.
- **Camada responsável:** P1.1 (envelope de eventos e proveniência) + P6.0.

#### 28 — §8.2 Níveis graduados de autonomia
- **Cláusula R8:** autonomia graduada, distinta de proatividade; ações materiais exigem confirmação compatível com o nível (§3.25).
- **Classificação:** ausente
- **Marcadores:** **high_risk** · decisão necessária
- **Evidência (a/b):** `grep -rin "autonomy\|autonomia\|approval_mode\|confirm_required" src supabase/migrations` → zero ocorrências. Existe apenas o registro pós-fato em `ai_audit_log(action, payload, result, status, reason)` e `ai_capture_sessions`; e a aprovação manual pontual da UI de `/ia` (`applyAuditWrite`).
- **Símbolos:** `src/lib/ia-capture-apply.ts`, `src/lib/ia-capture.functions.ts`, `src/lib/assistant.functions.ts` (escrita direta sem gate), `src/lib/ai-guardrails.server.ts`.
- **Lacuna:** o mesmo sistema tem dois regimes de fato — `/ia` audita, `/assistente` grava direto — sem nível declarado que explique a diferença.
- **Reutilização:** média — `ai_audit_log` é a base de auditoria; falta a política que decide antes da escrita.
- **Risco:** **alto** — escrita autônoma no domínio sem nível declarado nem confirmação uniforme para ação material.
- **Decisão necessária:** enum de níveis de autonomia e quais operações são “materiais”.
- **Camada responsável:** P4.0 (genealogia de triggers) com pré-requisito em P1.0.

#### 29 — §9.1–§9.3 Cinco planos, perfis de presença e Ambient Wake
- **Cláusula R8:** autorização, aquisição, interpretação, persistência e manifestação como planos independentes; perfis `Manual Only`/`Ambient Wake`/`Ambient Journal`/`Session Lab`/`Custom`; wake phrases com buffer volátil, indicador persistente, cooldown e fallback manual.
- **Classificação:** ausente
- **Marcadores:** **cenográfico (parcial, herdado do eixo 21)** · risco médio · decisão necessária
- **Evidência (a/b):** `grep -rin "wake_phrase\|hotword\|presence_profile\|ambient"` → nenhuma ocorrência funcional (só texto de prompt e um glow decorativo em `src/routes/index.tsx:63`). Nenhuma tabela `ambient_presence_profiles`, `live_sessions`, `perception_channels`, `wake_events`, `consent_contexts` nas 87 migrations.
- **Existente adjacente:** `useSpeechToText.ts` (captura sob toque), `useWakeLock.ts`/`WakeLockProvider.tsx` (tela acesa — não é wake word), `BarcodeScanner.tsx` (câmera sob demanda).
- **Lacuna:** integral. Os cinco planos não são separáveis hoje: silenciar a voz e parar de capturar são o mesmo botão.
- **Reutilização:** baixa no conceito, alta na infraestrutura de mic/câmera já existente.
- **Risco:** médio — e o limite técnico de §9.6 é real: PWA/aba não garante escuta contínua em background.
- **Decisão necessária:** aceitar escopo foreground-only por ora, ou declarar dependência de app nativo antes de prometer Ambient Wake.
- **Camada responsável:** P8 (presença), fora do escopo P1–P5.

#### 30 — §11.1 Camadas de memória L0–L6
- **Cláusula R8:** L0 buffer efêmero · L1 eventos técnicos · L2 Log Vivo revisável · L3 episódios consolidados · L4 semântica versionada · L5 procedural recalibrável · L6 contexto efêmero de trabalho.
- **Classificação:** parcial
- **Marcadores:** risco médio (o risco alto de memória já está contado no eixo 14) · decisão necessária
- **Evidência (b):** L1 **existe** — `execution_events`, `ai_audit_log`, `xp_events`, `brasas_events` (append-only). L2 **parcial** — `assistant_messages`, `chat_conversations`, `mental_journal`, `dream_logs` são cronológicos mas sem revisão com proveniência. L6 **existe** — `SharedContext` em `src/lib/wimi-memory.ts` (volátil, por chamada). L0, L3, L4 e L5 **ausentes**: `grep -rln "memory_" supabase/migrations` → zero tabelas `memory_*`.
- **Lacuna:** 3 das 7 camadas existem parcial ou integralmente; 4 não existem. Sem `memory_retrieval_trace`, sem versionamento, sem expiração lógica.
- **Reutilização:** média-alta em L1/L2; nula em L3–L5.
- **Risco:** médio — construir L4 antes de L2 revisável repetiria o erro que a R8 proíbe (embeddings só após fundação verificável).
- **Decisão necessária:** ordem de implantação das camadas e onde mora `memory_retrieval_trace`.
- **Camada responsável:** P6.0 (memória transparente).

#### 31 — §13.4 Estados honestos por superfície
- **Cláusula R8:** cada superfície possui loading, vazio, erro, offline/falha e retry; indicadores distinguem autorização, captura, interpretação, persistência e voz.
- **Classificação:** parcial
- **Marcadores:** risco médio · decisão necessária
- **Evidência (a):** `errorComponent: ErrorComponent` em `src/routes/__root.tsx:122` (erro global); `src/components/pwa/PWAStatus.tsx:22` usa `navigator.onLine` (único ponto de offline); 52 ocorrências de `loading` local nas 38 rotas de `_authenticated`; apenas 2 rotas usam `useQuery` — o restante é `useState` + `useEffect`, sem estado de erro padronizado nem retry.
- **Lacuna:** não há retry por superfície, nem vazio consistente, nem os indicadores de captura/interpretação/persistência exigidos por §13.4. Erro é global, não por painel.
- **Reutilização:** média — `MobileShell` é o hospedeiro natural de um padrão único de estados.
- **Risco:** médio — falha silenciosa de rede aparece como tela vazia, o que a R8 classifica como desonesto (§3.7: ausência de registro ≠ não aconteceu).
- **Decisão necessária:** padronizar em TanStack Query com estados derivados, ou criar um componente de estado reaproveitável.
- **Camada responsável:** P5.0/P5.1 (Cockpit e execução objetiva).

#### 32 — §15 Segurança funcional, consentimento e governança
- **Cláusula R8:** segurança funcional, consentimento visível/granular/revisável (§3.19), retenção declarada, RLS, idempotência e rollback como invariantes.
- **Classificação:** parcial
- **Marcadores:** **high_risk** · decisão necessária
- **Evidência (b):** 85 tabelas em `public`, **100 % com RLS**, 179 policies, 54 funções (**45 `SECURITY DEFINER`** não auditadas individualmente), 0 views. **(a):** `src/lib/ai-guardrails.server.ts` (rate limit por processo, truncagem `MAX_USER_CHARS`, cláusula de crise, anti-injeção); `src/routes/api/public/hooks/push-notification.ts` com `WEBHOOK_SECRET` + `timingSafeEqual`; `MODELO_REGULAMENTACAO_IA.md` presente no repositório.
- **Lacuna:** governança documentada sem contraparte executável — nenhuma tabela de consentimento (`grep -l consent supabase/migrations` → vazio), nenhuma política de retenção ou expurgo, nenhum owner declarado das 45 funções `SECURITY DEFINER`, rate limit em memória de processo (não sobrevive a múltiplas instâncias).
- **Reutilização:** alta na camada RLS; baixa em consentimento e retenção.
- **Risco:** **alto** — exposição regulatória sobre dados de saúde, sono, sonhos e mensagens; agravado por rate limit não distribuído.
- **Decisão necessária:** owner da governança e matriz de retenção por tabela (relacionada, mas distinta, da decisão do eixo 19, que trata da presença ambiental).
- **Camada responsável:** P1.1 (RLS e envelope) + P5 (conformidade).

---

### Recontagem sobre as 32 unidades

| Classificação | Identificadores | Total |
|---|---|---|
| reutilizável | 2, 11, 12, 17, 20 | **5** |
| parcial | 1, 3, 4, 5, 6, 10, 13, 14, 15, 16, 19, 21, 22, 23, 25, 27, 30, 31, 32 | **19** |
| incompatível | — | **0** |
| ausente | 7, 8, 9, 18, 24, 26, 28, 29 | **8** |

`5 + 19 + 0 + 8 = 32` ✔

Marcadores transversais (fora da soma):

- **cenográfico:** 21 (wearables sem ingestão) e 29 (presença ambiental prometida sem aquisição) → **2**
- **anotações de risco:** uma por unidade → **32**
- **high_risks:** 3, 7, 8, 9, 14, 19, 22, 23, 24, 28, 32 → **11**
- **decisões necessárias:** 1, 3, 5, 7, 11, 12, 14, 18, 19, 21, 24, 26, 27, 28, 29, 30, 31, 32 → **18**

---

### Pacote de Retorno

```yaml
program_id: WIMI-3.7-R8
layer: P0.2
repair_attempt: 1
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
head_inspected: c8b56b21606c307da5df916843f9ffcefeed6d4b
deltas_between_shas: documental_only
deltas_detail:
  - "M .lovable/plan.md"
  - "A .lovable/wimi-r8-checkpoint.md"
code_equivalence_confirmed: true

result: revised
base_command_axes: 25
supplemental_canonical_axes: 7
coverage_units_total: 32

reusable: 5
partial: 19
incompatible: 0
absent: 8
classification_sum_check: "5 + 19 + 0 + 8 = 32 (fechado)"

scenographic: 2
high_risks: 11
risk_annotations_total: 32
decisions_required: 18

classification_item_ids:
  reusable: [2, 11, 12, 17, 20]
  partial: [1, 3, 4, 5, 6, 10, 13, 14, 15, 16, 19, 21, 22, 23, 25, 27, 30, 31, 32]
  incompatible: []
  absent: [7, 8, 9, 18, 24, 26, 28, 29]
  scenographic: [21, 29]
  high_risks: [3, 7, 8, 9, 14, 19, 22, 23, 24, 28, 32]
  decisions_required: [1, 3, 5, 7, 11, 12, 14, 18, 19, 21, 24, 26, 27, 28, 29, 30, 31, 32]

errata_applied:
  - "reutilizável 4 → 5 na matriz original (eixos 2, 11, 12, 17, 20)"
  - "campo 'risks: 9' substituído por 'high_risks'; recalculado para 11 sobre 32 unidades"
  - "risk_annotations_total registrado separadamente = 32"
  - "SHA de dependência e HEAD inspecionado registrados em campos distintos"

canonical_clauses_now_covered:
  - "§5.2 modos de alinhamento (unidade 26)"
  - "§7.4 Transcrição Viva Editável (unidade 27)"
  - "§8.2 níveis graduados de autonomia (unidade 28)"
  - "§9.1–§9.3 cinco planos, perfis de presença, Ambient Wake (unidade 29)"
  - "§11.1 camadas de memória L0–L6 (unidade 30)"
  - "§13.4 estados honestos por superfície (unidade 31)"
  - "§15 segurança funcional e governança (unidade 32)"

remaining_coverage_gaps:
  - "§9.5 orçamento sensorial — sem eixo próprio; tratado como subitem de 21/29"
  - "§10.5 Estúdio de Presença e Estúdio Wi/Mi com ciclo draft/testing/published/retired — coberto apenas por tabela em 18/20"
  - "§8.4 fila e concorrência (claim transacional, lease, idempotency_key) — coberto parcialmente pelo eixo 10, sem detalhamento de concorrência"
  - "§16–§20 (cortes de produto, gates, critérios de aceite, regra final) são meta-programa e não foram convertidos em unidades"

evidence_gaps:
  - "build, typecheck e lint permanecem não executados (herdado de P0.1, alvo de P0.3)"
  - "45 funções SECURITY DEFINER não auditadas individualmente"
  - "runtime não observado: idempotência de eventos, latência, bateria, custo de IA"
  - "leituras de banco refletem o ambiente atual, não um snapshot em a4db78b"
  - "documentos R8 lidos dos anexos; não persistidos no repositório"

pending_decisions_recorded_not_executed:
  - "persistência futura dos três documentos R8 no repositório"
  - "testes, rollback e feature flags como gate bloqueante antes de P2"

files_created: []
files_changed: []
code_changed: false
database_changed: false
git_status_before: clean
git_status_after: clean
no_changes_made: true

ready_for_validation: true
ready_for_approval: false
ready_for_next_layer: false
recommended_next_command: "VALIDAR WIMI-R8 — P0.2-R1"
```

### Fora do escopo

Nenhuma solução implementada, nenhuma reconstrução proposta, P0.3 não iniciado.
