## REPARAR WIMI-R8 — P0.2-R2

Operação estritamente em leitura; **nenhum comando mutativo executado**. `git status --porcelain` vazio antes e depois. Documentos R8 lidos do mount de upload, não persistidos no repositório.

### Identidade verificada no início da operação

| Item | Valor |
|---|---|
| Branch inspecionada | `edit/edt-fbfb698f-4c42-414c-9ee6-f6241c558572` |
| `head_last_validated` | `be947b5744330a8735f61c39d6b2ba74e7b0b618` |
| `head_inspected_at_repair` | `be947b5744330a8735f61c39d6b2ba74e7b0b618` (inalterado) |
| `git diff a4db78b..HEAD` | `M .lovable/plan.md`, `A .lovable/wimi-r8-checkpoint.md` |
| Diff em `src supabase package.json bun.lock vite.config.ts tsconfig.json public` | vazio → equivalência de código confirmada |

---

## Bloco A — eixos-base 1–25 (preservados; camadas corrigidas)

| # | Requisito | Classificação | Marcadores | Camada canônica | Reparo |
|---|---|---|---|---|---|
| 1 | Contratos e vocabulário canônico | parcial | risco médio · decisão | P1.0 | preserved |
| 2 | Modelo de dados, migrations, RLS, isolamento | reutilizável | risco baixo-médio | P0.3 / P1.1 | preserved |
| 3 | Classes epistêmicas e proveniência | parcial | **high_risk** · decisão | P1.1 | preserved |
| 4 | Execução Basal da Jornada | parcial | risco médio | P2.0 | preserved |
| 5 | Três portas de entrada | parcial | risco médio · decisão | P2.1 | preserved |
| 6 | Segmentos e temporalidades | parcial | risco médio | P2.1 / P2.2 | preserved |
| 7 | Grafo, branches e relações | ausente | **high_risk** · decisão | **P2.2** | corrected |
| 8 | Três slots operacionais | ausente | **high_risk** | **P3.0** | corrected |
| 9 | Espera ocupando / liberando slot | ausente | **high_risk** | **P3.1** | corrected |
| 10 | Fila, concorrência, retomada e prioridade (§8.4) | parcial | **high_risk** · decisão | **P3.2 + P4.1** (cruz. P2.2) | **expanded** |
| 11 | Triggers e sequências | reutilizável | risco médio · decisão | **P4.0 / P4.1** | corrected |
| 12 | Cockpit Executando e Live | reutilizável | risco baixo · decisão | **P5.0** | corrected |
| 13 | Lente Planejando | parcial | risco médio | P5.2 | preserved |
| 14 | Memória (visão de produto) | parcial | **high_risk** · decisão | **P6.0** | corrected |
| 15 | Proatividade | parcial | risco médio-alto | **P7.1** | corrected |
| 16 | Bem-estar | parcial | risco médio | **P6.1** | corrected |
| 17 | Gamificação | reutilizável | risco médio | **P6.2** | corrected |
| 18 | Dualidade Wi — Tutora / Mi — Mentor | ausente | risco médio-alto · decisão | **P7.0** | corrected |
| 19 | Presença, consentimento e retenção | parcial | **high_risk** · decisão | P1.1 + conformidade | preserved |
| 20 | Voz, STT, TTS e identidade vocal | reutilizável | risco médio | **P10.0** (P9.1 quando aplicável) | corrected |
| 21 | Sensores, câmera, wearables, Wake Lock | parcial | **cenográfico** · risco médio · decisão | **P9.3** | corrected |
| 22 | Notificações e background | parcial | **high_risk** · **decisão (agora listada)** | **P4.2 / P7.1** | corrected |
| 23 | Observabilidade | parcial | **high_risk** | **P0.4 + aceite GF** (sem camada dedicada) | corrected |
| 24 | Testes, rollback e feature flags | ausente | **high_risk (crítico)** · decisão | P0.3 | preserved |
| 25 | Acessibilidade e experiência mobile | parcial | risco médio | **§13.5 + aceite GF** (sem camada dedicada) | corrected |

Bloco B (26–32) preservado integralmente da matriz R1, com duas correções de camada: **27 → P9.1** (P1.1 permanece pré-requisito de proveniência) e **29 → P8.0/P8.1 (perfis, wake simulada), P9.0 (wake word local), P9.2 (Ambient Journal)**. As demais camadas de 26 (P5.2), 28 (P4.0, pré-req. P1.0), 30 (P6.0), 31 (P5.0/P5.1) e 32 (P1.1 + conformidade) estavam corretas.

---

## Eixo 10 — expansão literal de §8.4

- **Cláusula R8 (§8.4, l.409-419):** claim transacional; lease e recuperação segura; retry limitado; deduplicação; branch e join; reordenação append-only; itens humanos não desaparecem silenciosamente; sugestões da Wimi podem expirar; ações materiais não são repetidas silenciosamente.
- **Classificação principal:** parcial (mantida).
- **O que existe:** append-only de fato em `execution_events`, `ai_audit_log`, `xp_events`, `brasas_events`; ordenação temporal em `scheduled_quests` / `user_missions`; auditoria pós-fato em `ai_audit_log`; dedup textual local no STT (`finalResultKeysRef`, `useSpeechToText.ts:116/230`).
- **O que está ausente (evidência a):** `grep -rin "idempotency\|lease\|claim" supabase/migrations` → **zero ocorrências**. Não há claim transacional, lease com expiração, retry limitado, `idempotency_key`, join de branches, nem regra de expiração de sugestão. `journey-tick` dispara sem chave de idempotência.
- **Referência cruzada:** branch e join dependem do eixo 7 (grafo, `ausente`, P2.2).
- **Reutilização:** média — o padrão append-only e `execution_events` são a base do event log; falta a camada de concorrência.
- **Risco:** alto — ação material (push, escrita de missão) pode ser repetida em execução concorrente ou reentrada do cron.
- **Decisão necessária:** onde mora `idempotency_key` (evento vs. trigger vs. ação material) e qual o TTL do lease.
- **Camadas:** P3.2 (fila e retomada) + **P4.1** (garantias de §8.4), com P2.2 para branch/join.

---

## Unidade 33 — §9.5 Orçamento sensorial (added)

- **Cláusula R8 (l.507-519):** áudio como trilha principal; imagem sob demanda, por mudança relevante ou amostragem adaptativa; movimento agregado localmente; **vídeo contínuo nunca enviado ao modelo**; somente o foreground controla a fonte sensorial; execuções paralelas recebem observações por vínculo explícito; custo, rede, bateria e temperatura limitam frequência; perfis iniciais 120s/60s/30s/rajada/captura explícita sujeitos a medição no dispositivo-alvo.
- **Classificação principal:** **ausente**
- **Marcadores:** risco médio · decisão necessária (não `cenográfico` — a UI não promete orçamento sensorial; a promessa cenográfica pertence a 21 e 29)
- **Evidência (a):** `grep -rniE "budget|orcamento|sampling|amostragem|framerate|battery|getBattery|thermal|temperatur" src` → **zero ocorrências**. Não há Battery Status API, nem amostragem adaptativa, nem qualquer teto de frequência.
- **Origem:** arquivo (grep em `src`); confirmado por ausência no banco (nenhuma tabela de perfil sensorial).
- **Símbolos adjacentes:** `src/hooks/useSpeechToText.ts` (áudio sob toque, religa via `onend` sem teto), `src/components/plano/BarcodeScanner.tsx` (câmera sob demanda, uso pontual), `src/routes/_authenticated/ia.tsx:172-177` (`MediaRecorder`, `audio/webm` enviado ao servidor sem limite de duração ou custo), `src/lib/ai-guardrails.server.ts` (rate limit de texto por processo — único orçamento existente, e não sensorial).
- **Lacuna exata:** nenhum plano de orçamento. Não há política de custo/latência/bateria/temperatura, nem aquisição adaptativa, nem degradação segura quando o orçamento é excedido. A invariante "vídeo contínuo não vai ao modelo" é hoje verdadeira por omissão (não há vídeo), não por política — não é verificável nem defensável quando a captura crescer.
- **Reutilização:** baixa no conceito; média na infraestrutura — `ai-guardrails.server.ts` é o local natural para o teto de custo, e o rate limit por processo já demonstra o padrão (embora não distribuído).
- **Risco:** médio — sem teto, a manifestação contínua do `/executar` pode drenar bateria e custo de IA sem sinal ao usuário; agrava-se com o `useWakeLock` global mantendo a tela acesa.
- **Decisão necessária:** os limites são globais, por perfil de presença ou por execução; e o que acontece ao exceder — degradar amostragem, cair para manual, ou avisar e parar.
- **Camada futura canônica:** **P9.3 — Imagem e movimento**, com dependência dos perfis definidos em P8.0 e teto de custo herdado de P4.2 (fontes externas).
- **Status do reparo:** added.

---

## Unidade 34 — §10.5 Estúdios (added)

- **Cláusula R8 (l.580-595):** Estúdio de Presença e Estúdio Wi/Mi parametrizam personas, vozes, ritmo, idioma e pronúncia; apresentações e passagens; regras contextuais; wake phrases, limiares e cooldown; canais, buffer, amostragem e retenção; preview e comparação A/B; ciclo `draft` → `testing` → `published` → `retired`; publicação interna, auditoria e rollback. **Configuração não altera texto canônico nem amplia autonomia.**
- **Classificação principal:** **ausente**
- **Marcadores:** risco médio · decisão necessária
- **Evidência (a/b):** existe um "Studio" homônimo mas de outro domínio — `src/lib/studio.ts` e `src/routes/_authenticated/studio.tsx` operam `studio_challenges` / `studio_rewards` / `studio_challenge_rewards` / `studio_challenge_participants` (gamificação). Seu ciclo é `draft | published | archived` (`studio.ts:34`), com publicação via `update({ status: "published" })` (`studio.ts:106`) e gate por `user_roles` (`studio.ts:41`). Não há `testing`, não há `retired`, não há preview, A/B, versionamento nem rollback. Nenhuma tabela de persona, voz, wake phrase ou perfil de presença nas 87 migrations.
- **Origem:** arquivo (`src/lib/studio.ts`, `src/routes/_authenticated/studio.tsx`) + banco (ausência de tabelas de persona/presença).
- **Lacuna exata:** a existência conceitual de Wi/Mi (eixo 18, `ausente`) e da voz (eixo 20, `reutilizável`) **não** implica existência funcional dos Estúdios. Falta todo o ciclo de vida versionado, a ativação/desativação, a auditoria de publicação e o rollback. A invariante "configuração não amplia autonomia" não tem contraparte executável porque não há nível de autonomia declarado (unidade 28).
- **Reutilização:** média — `studio_challenges` fornece o padrão de status + gate por role e pode ser generalizado; `chat_settings` já persiste preferências de voz/gênero/persona por usuário, mas como preferência, não como artefato versionado e publicável.
- **Risco:** médio — publicar persona/voz sem versionamento nem rollback torna uma regressão de identidade irreversível; agravado por depender da unidade 28 para a invariante de autonomia.
- **Decisão necessária:** o Estúdio é global (curadoria interna) ou por usuário; e se o ciclo canônico substitui ou coexiste com o `draft/published/archived` já em uso na gamificação.
- **Camada futura canônica:** **P8.0 — Perfis e Estúdio de Presença** (ciclo e perfis) e **P10.0 — Identidade vocal e Estúdios integrados** (Estúdio Wi/Mi, pós-MVP), com P7.0 como pré-requisito do kernel Wi/Mi.
- **Status do reparo:** added.

---

## Correções de evidência

| Item | Correção |
|---|---|
| Loading | "52 ocorrências" → **51 linhas encontradas** por `grep -c` em `src/routes/_authenticated/*.tsx`. Métrica **aproximada e frágil** (conta linhas, não ocorrências). Não convertida em número de rotas sem nova contagem. |
| Áudio bruto | Não foi encontrada persistência de áudio bruto em storage (únicos uploads: `challenge-photos` em `challenges.ts:205` e o bucket social em `feed.ts:47`). Porém `ia.tsx:172-177` usa `MediaRecorder` e **transmite `audio/webm` ao servidor**. "Áudio bruto desligado por padrão" (§7.4) permanece **não verificado**. Não se conclui "não existe áudio bruto". |
| Banco | 85 tabelas · 85 com RLS (100%) · 179 policies · 54 funções · 45 `SECURITY DEFINER` · 0 views · 0 matviews · 0 tabelas de consentimento · 0 tabelas `memory_*` — **reflete o ambiente atual, não um snapshot de `a4db78b`**. |
| HEAD | `head_last_validated` e `head_inspected_at_repair` registrados em campos distintos (coincidem nesta operação). |

Demais evidências reconfirmadas: 87 migrations; 38 arquivos em `_authenticated`; 0 testes e nenhum script `test`; zero ocorrências de feature flag, autonomia, modos de alinhamento e wake phrase; STT com `interimResults = true` (l.178) e dedup (l.116/230); `errorComponent` global (`__root.tsx:122`); `navigator.onLine` único em `PWAStatus.tsx:22`; 2 rotas com `useQuery`; zero `retry` em `_authenticated`; `isQuietNow` (`push.server.ts:32`) usando `new Date().getHours()` do processo servidor, ignorando o fuso do usuário.

---

## Recontagem sobre as 34 unidades

| Classificação | IDs | Total |
|---|---|---|
| reutilizável | 2, 11, 12, 17, 20 | **5** |
| parcial | 1, 3, 4, 5, 6, 10, 13, 14, 15, 16, 19, 21, 22, 23, 25, 27, 30, 31, 32 | **19** |
| incompatível | — | **0** |
| ausente | 7, 8, 9, 18, 24, 26, 28, 29, **33**, **34** | **10** |

`5 + 19 + 0 + 10 = 34` ✔

Marcadores transversais (fora da soma):
- **cenográfico:** 21, 29 → **2** (33 não entra: não há promessa de orçamento na UI)
- **anotações de risco:** uma por unidade → **34**
- **high_risks:** 3, 7, 8, 9, 10, 14, 19, 22, 23, 24, 28, 32 → **12** (10 sobe a high_risk pela expansão de §8.4: repetição de ação material)
- **decisões necessárias:** 1, 3, 5, 7, 10, 11, 12, 14, 18, 19, 21, **22**, 24, 26, 27, 28, 29, 30, 31, 32, **33**, **34** → **22** (18 → +22 = 19 base → +10 já contava → +33 → +34; total recalculado, não forçado)

---

## Gates pendentes (registrados, não executados)

1. Persistir os três documentos R8 no repositório **antes de P1.0**.
2. **P0.3 permanece estritamente read-only**.
3. Testes mínimos, feature flags e estratégia de rollback como **gate bloqueante antes de P2.0**.
4. Build, lint e typecheck **somente em P0.3**.
5. Congelamento do resultado da auditoria em **P0.4**.

---

## Pacote de Retorno

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R2
repair_attempt: 2
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_inspected: edit/edt-fbfb698f-4c42-414c-9ee6-f6241c558572
head_last_validated: be947b5744330a8735f61c39d6b2ba74e7b0b618
head_inspected_at_repair: be947b5744330a8735f61c39d6b2ba74e7b0b618
code_equivalence_confirmed: true
documental_deltas:
  - "M .lovable/plan.md"
  - "A .lovable/wimi-r8-checkpoint.md"
result: revised

base_command_axes: 25
supplemental_units_r1: 7
supplemental_units_r2: 2
coverage_units_total: 34

units_preserved: [1, 2, 3, 4, 5, 6, 13, 19, 24, 26, 28, 30, 31, 32]
units_expanded: [10]
units_added: [33, 34]
units_corrected: [7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 25, 27, 29]

reusable: 5
partial: 19
incompatible: 0
absent: 10
classification_sum_check: "5 + 19 + 0 + 10 = 34 (fechado)"

classification_item_ids:
  reusable: [2, 11, 12, 17, 20]
  partial: [1, 3, 4, 5, 6, 10, 13, 14, 15, 16, 19, 21, 22, 23, 25, 27, 30, 31, 32]
  incompatible: []
  absent: [7, 8, 9, 18, 24, 26, 28, 29, 33, 34]

scenographic: 2            # [21, 29]
high_risks: 12             # [3, 7, 8, 9, 10, 14, 19, 22, 23, 24, 28, 32]
risk_annotations_total: 34
decisions_required: 22
decision_item_ids: [1, 3, 5, 7, 10, 11, 12, 14, 18, 19, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34]

unit_22_decision_resolution: >
  marcador mantido e eixo incluído na lista. isQuietNow (push.server.ts:32) usa a
  hora do processo servidor, ignorando o fuso do usuário, e §9.6 limita entrega em
  background numa PWA. A fonte autoritativa de fuso e o regime de entrega são
  decisão de operador, não bug isolado. Total-base 18 → 19; total final 22 após 33 e 34.
unit_33_classification: absent
unit_34_classification: absent

canonical_clauses_covered:
  - "§8.4 fila e concorrência — eixo 10 expandido (claim, lease, retry, dedup/idempotência, branch/join, append-only, expiração, não repetição)"
  - "§9.5 orçamento sensorial — unidade 33"
  - "§10.5 Estúdio de Presença e Estúdio Wi/Mi — unidade 34"

remaining_coverage_gaps:
  - "§16–§20 permanecem meta-programa (linha de produto, gates G0–GF, aceite, decisões históricas, regra final) — sem unidades funcionais, por decisão validada"
  - "§9.6 limite técnico tratado como restrição transversal das unidades 22, 29 e 33, sem unidade própria"

evidence_corrections:
  - "loading: 52 ocorrências → 51 linhas encontradas; métrica aproximada e frágil"
  - "áudio bruto: sem persistência em storage, mas MediaRecorder transmite audio/webm (ia.tsx:172-177); default off (§7.4) não verificado"
  - "leituras de banco: ambiente atual, não snapshot de a4db78b"
  - "eixo 10 elevado a high_risk pela expansão de §8.4"

future_layer_mapping_corrections: 17

remaining_evidence_gaps:
  - "build, typecheck e lint não executados (P0.3)"
  - "45 funções SECURITY DEFINER não auditadas individualmente"
  - "runtime não observado: idempotência, latência, bateria, temperatura, custo de IA"
  - "sem medição no dispositivo-alvo para calibrar §9.5"
  - "documentos R8 lidos dos anexos; não persistidos no repositório"

document_persistence_gate: "persistir os três documentos R8 antes de P1.0; P0.3 permanece read-only"
pre_p2_safety_gate: "testes mínimos + feature flags + rollback como gate bloqueante antes de P2.0"

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
operator_decision_required: true
recommended_next_command: "VALIDAR WIMI-R8 — P0.2-R2"
```

### Fora do escopo

P0.2-R2 não aprovado. P0.3 não iniciado. Nenhuma solução implementada.
