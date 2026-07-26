## VALIDAR WIMI-R8 — P0.2-R4 — resultado: `partial`

Validação estritamente em leitura. Nenhum arquivo criado, alterado ou removido; nenhuma operação Git mutativa; nenhum build, lint ou typecheck executado. P0.2 **não** aprovado, P0.3 **não** iniciado.

### 1. Identidade e não mutação

| Item | Valor observado |
|---|---|
| branch no início e no fim | `edit/edt-1b0cd27a-abaa-41f8-b901-e88a019f0987` |
| HEAD no início e no fim | `c6e4f6adf7898c9e6ead90ba1676301b985da3ac` |
| branch/HEAD reportados no R4 | `edit/edt-7356c809…` @ `ad1db214…` (ancestral; plataforma reabriu em nova branch) |
| `git status --porcelain` antes/depois | vazio / vazio |
| `git diff --name-status a4db78b..HEAD` | `M .lovable/plan.md`, `A .lovable/wimi-r8-checkpoint.md` |
| diff restrito a `src supabase package.json bun.lock vite.config.ts tsconfig.json public` | vazio → **equivalência de código com P0.1 confirmada** |
| arquivos tocados nesta validação | nenhum |

Todas as fontes obrigatórias estavam acessíveis (três documentos R8 anexados, `.lovable/wimi-r8-checkpoint.md`, matriz R4 materializada em `.lovable/plan.md`) — portanto **não** é `blocked`.

### 2. Completude da matriz — conforme

34 unidades materializadas na entrega, IDs 1–34 únicos e contínuos, 13 campos declarados e presentes em cada linha, nenhuma unidade substituída por referência externa, nenhum campo vazio ou deslocado detectado. `matrix_self_contained: true` confirmado.

### 3. Defeito 1 — vocabulário do 13º campo (resolução: opção B)

Na matriz, 19 unidades trazem no 13º campo os valores `corrected (mapeamento)`, `corrected (evidência e mapeamento)` e `corrected (decisão adicionada)`. O conteúdo parentético está no mesmo campo delimitado por `·`, sem separador que o isole como anotação: **faz parte do valor** e viola o vocabulário fechado `preserved | expanded | added | corrected`.

A partição YAML, isoladamente, está correta: preserved 12, expanded 1, added 2, corrected 19 = 34; união = 1–34; interseções vazias. Unidade 10 é legitimamente `expanded` (§8.4 aprofundada sobre baseline R1); 33 e 34 são legitimamente `added`; 26–32 corretamente **não** tratadas como adicionadas.

### 4. Defeito 2 — decisões necessárias subcontadas

`decision_ids_final` propõe 24 IDs, mas a leitura direta do campo 11 encontra **29 unidades com decisão concreta de operador**: as 24 propostas **mais 8, 9, 15, 17 e 20**, cada uma com decisão material (onde impor o limite de slots; política default ao estacionar; cooldown e supressão após recusa; derivar economia de eventos; manter provedor de voz no estudo técnico). Portanto `decisions_required: 24` não se sustenta semanticamente; a recontagem é **29** (18 de R1 + 11 adicionadas: 8, 9, 10, 15, 17, 20, 22, 24, 32, 33, 34).

As seis decisões fiscalizadas nominalmente (23, 25, 24, 32, 33, 34) estão presentes e concretas.

### 5. Classificações, marcadores e evidências — conforme

- `reusable [2,11,12,17,20]` 5 · `partial` 19 · `incompatible []` 0 · `absent` 10 → soma 34 confirmada por recontagem direta.
- `units_with_insufficient_evidence: [10,21,27,33]` e `scenographic: [15,21]` confirmados.
- `risk_annotations_total: 34` está corretamente definido como coluna de risco preenchida, distinto de `transversal_high_risk_marker_total: 11` ([7,8,9,10,19,22,24,29,30,32,33]). O termo solto `risco` no campo de marcadores das unidades 1, 3 e 15 é redundante e **não** foi confundido com `high_risk`, mas permanece **indefinido** — deve ser qualificado ou removido no R5.
- Evidências: valores de banco (85 tabelas, 179 policies, 54 funções, 45 SECURITY DEFINER, 0 views, 100% RLS) corretamente marcados como estado atual e não snapshot de P0.1; loading 51×77 corretamente qualificado como não comparável e não equivalente a rotas; áudio com transmissão comprovada e persistência não comprovada; buckets, runtime e auditoria individual das 45 funções preservados como lacunas.

### 6. Mapeamentos — 18 IDs verificados contra títulos literais

Confrontados um a um com os cabeçalhos de seção dos Prompts Sequenciais: 7→P2.2, 8→P3.0, 9→P3.1, 10→P4.1 (pré-req P3.2), 11→P4.0, 12→P5.0 (compartilhada P5.1), 14→P6.0, 15→P7.1, 16→P6.1, 17→P6.2, 18→P7.0, 20→P10.1 (pré-req P10.0), 21→P8.0 (real em P9.0), 22→P7.1 (compartilhada P8.0), 27→P9.1, 29→P9.2 (pré-req P8.0/P8.1) — todos `confirmed` contra título literal. 23 e 25 `confirmed` como `no_dedicated_layer` com gate citado, **não** lacunas. 33→P9.3 e 34→P8.0 + P10.3 confirmados; P10.0 corretamente descartado como sede dos Estúdios.

Totais confirmados: 18 IDs, 16 dedicados/compartilhados, 2 `no_dedicated_layer`, 18 resolvidos, `remaining_mapping_gaps: []`.

Duas ressalvas documentais:
- a frase "as divergências restantes eram rótulos genéricos" continua **não demonstrada** — o R4 não apresenta a tabela ID × destino R2 × destino R3 × destino R4 exigida;
- os Prompts Sequenciais nomeiam P10.0 como **"Estudo vocal"** na tabela de dependências (linha 199) e **"Estudo técnico"** no cabeçalho da seção (linha 650). O R4 usa apenas "Estudo técnico"; a divergência interna da fonte deve ser registrada.

### 7. Cobertura e gates

§8.4 coberta pela unidade 10; §9.5 pela 33; §10.5 pela 34; §9.6 transversal; §16–§20 como meta-programa. `remaining_coverage_gaps: []` confirmado. Registrados sem execução: persistência dos três documentos R8 antes de P1.0 (a leitura dos anexos **não** satisfaz o gate); P0.3 read-only; build/lint/typecheck só em P0.3; testes mínimos, feature flags e rollback como gate bloqueante antes de P2.0; congelamento em P0.4.

### 8. Reparo prescrito — P0.2-R5, exclusivamente editorial

1. Remover o conteúdo parentético do 13º campo, deixando apenas `preserved | expanded | added | corrected`, e reposicionar a natureza do reparo em campo/anotação separada.
2. Recontar as decisões: `decision_ids_final` com 29 IDs, `decision_ids_added` com 11, `decisions_required: 29`, com justificativa por ID para 8, 9, 15, 17 e 20.
3. Definir ou remover o marcador solto `risco` das unidades 1, 3 e 15.
4. Materializar a tabela comparativa ID × R2 × R3 × R4 × título literal × veredito para os 18 mapeamentos.
5. Registrar a divergência de título de P10.0 na fonte canônica.

### Pacote de validação

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R4
validation_result: partial
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_validated: edit/edt-1b0cd27a-abaa-41f8-b901-e88a019f0987
head_validated: c6e4f6adf7898c9e6ead90ba1676301b985da3ac
code_equivalence_confirmed: true
documental_deltas: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
matrix_self_contained: true
coverage_units_total: 34
matrix_fields_per_unit: 13
unit_ids_complete_and_unique: true
units_with_field_errors: []
repair_status_vocabulary_result: violated
repair_status_parenthetical_resolution: "B — parte do valor do 13o campo; vocabulario fechado violado em 19 unidades"
units_preserved: [1,2,3,4,5,6,13,19,26,28,30,31]
units_expanded: [10]
units_added: [33,34]
units_corrected: [7,8,9,11,12,14,15,16,17,18,20,21,22,23,24,25,27,29,32]
repair_status_partition_check: "12 + 1 + 2 + 19 = 34; uniao 1..34; intersecoes vazias — correto"
reusable: [2,11,12,17,20]
partial: [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32]
incompatible: []
absent: [7,8,9,18,24,26,28,29,33,34]
classification_sum_check: "5 + 19 + 0 + 10 = 34 — confirmado"
units_with_insufficient_evidence: [10,21,27,33]
scenographic: [15,21]
risk_annotation_definition: non_empty_risk_column
risk_annotation_item_ids: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
risk_annotations_total: 34
transversal_high_risk_marker_ids: [7,8,9,10,19,22,24,29,30,32,33]
transversal_high_risk_marker_total: 11
ambiguous_risk_marker_ids: [1,3,15]
ambiguous_risk_marker_resolution: "marcador 'risco' indefinido; nao alterou listas formais; exige definicao ou remocao em R5"
decision_ids_r1: [1,3,5,7,11,12,14,18,19,21,23,25,26,27,28,29,30,31]
decision_ids_added: [8,9,10,15,17,20,22,24,32,33,34]
decision_ids_removed: []
decision_ids_final: [1,3,5,7,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
decisions_required_recounted: 29
decision_count_resolution: "18 + 11 = 29; R4 declarou 24 e omitiu 8, 9, 15, 17 e 20, que contem decisao concreta no campo 11"
decision_items_confirmed: [1,3,5,7,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
decision_items_unsupported: []
future_layer_mapping_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,25,27,29]
dedicated_or_shared_layer_mapping_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,27,29]
no_dedicated_layer_ids: [23,25]
future_layer_mapping_resolved_total: 18
future_layer_mapping_destinations: "conforme R4; todos batem com os titulos literais das secoes dos Prompts Sequenciais"
future_layer_mapping_verdicts: "confirmed para os 18"
future_layer_mapping_corrections_confirmed: 18
r2_vs_r3_vs_r4_mapping_resolution: "insufficient_evidence — tabela comparativa ID x R2 x R3 x R4 nao apresentada; afirmacao 'rotulos genericos' nao demonstrada"
unit_10_validation: "expanded; P4.1 com pre-requisito P3.2 — confirmado"
unit_23_validation: "no_dedicated_layer resolvido em PF.1/PF.2 — confirmado, nao e lacuna"
unit_25_validation: "no_dedicated_layer resolvido em P5.0 e revalidado em PF.1 — confirmado, nao e lacuna"
unit_33_validation: "added; P9.3 — Imagem e movimento — confirmado literalmente"
unit_34_validation: "added; P8.0 + P10.3 — Estudios integrados — confirmado; P10.0 corretamente descartado"
canonical_layer_titles_verified: true
remaining_mapping_gaps: []
evidence_validation: "banco = current_database_evidence e nao snapshot de P0.1; loading = inference nao comparavel; audio bruto = insufficient_evidence; claim/lease/idempotency_key ausentes = file_evidence; append-only = file_evidence; isQuietNow sem fuso = file_evidence; testes/flags ausentes = file_evidence; orcamento sensorial e ciclo dos Estudios inexistentes = file_evidence; /studio homonimo = file_evidence"
evidence_corrections: []
remaining_evidence_gaps: ["buckets de storage nao inspecionados", "runtime nao observado (idempotencia, latencia, bateria, temperatura, custo)", "45 funcoes SECURITY DEFINER nao auditadas individualmente", "build, lint e typecheck reservados a P0.3", "divergencia de titulo de P10.0 na fonte canonica (Estudo vocal x Estudo tecnico)"]
remaining_coverage_gaps: []
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
ready_for_approval: false
ready_for_next_layer: false
operator_decision_required:
  - "autorizar reparo editorial localizado P0.2-R5"
  - "confirmar a recontagem de decisoes para 29"
  - "decidir persistencia dos tres documentos R8 antes de P1.0"
recommended_next_command: "REPARAR WIMI-R8 — P0.2-R5"
```

P0.2 não aprovado. P0.3 não iniciado.
