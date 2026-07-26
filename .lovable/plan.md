## VALIDAR WIMI-R8 — P0.2-R3 (leitura estrita)

Nenhum arquivo foi criado, alterado ou removido. Apenas comandos Git e greps de leitura.

### 1. Identidade e não mutação — divergência encontrada

| Campo | Declarado no R3 | Verificado agora |
|---|---|---|
| branch | `edit/edt-e00150cd-40c2-4798-b166-ee042150cda6` | `edit/edt-6a98bef6-7138-485e-920e-23d7040c542a` |
| HEAD | `82d9ca0139e4…` | `2a4269401bc407ca408c367c96d3c0721ad126f1` |
| `git status --porcelain` | clean | clean (antes e depois) |
| `git diff --name-status a4db78b..HEAD` | `M .lovable/plan.md`, `A .lovable/wimi-r8-checkpoint.md` | idêntico |
| diff em `src supabase package.json bun.lock vite.config.ts tsconfig.json public` | vazio | vazio |

A equivalência de código com o checkpoint P0.1 permanece **confirmada** e os deltas seguem **exclusivamente documentais**. O par branch/HEAD declarado está desatualizado (a plataforma reabriu a sessão de edição em nova branch), o que reproduz, agora contra o R3, o mesmo problema de identidade que o R3 dizia ter resolvido.

Frase de identidade Git: o R3 informa HEAD, status e diff, portanto executou leituras Git. `"nenhuma operação Git executada"` é falso e deve ser substituído por **`"nenhuma operação Git mutativa executada"`**.

Distinção exigida: `files_created: []` e `files_changed: []` **nesta operação**; os dois deltas documentais entre P0.1 e HEAD são **pré-existentes**, não produzidos por P0.2-R3 nem por esta validação.

### 2. Completude da matriz

34 unidades, IDs únicos e contínuos de 1 a 34, nenhuma apenas referenciada, 13 campos por unidade, sem deslocamento de colunas. **Confirmado.**

### 3. Vocabulário do 13º campo — correção editorial necessária

O R3 usa `materializado` nas 34 unidades. Não há autorização documental posterior para substituir o vocabulário exigido (`preserved` / `expanded` / `added` / `corrected`). Vale a hipótese **A**: `materializado` é indicador editorial de self-containment e o status formal do reparo **ainda falta**. Status correto por unidade:

- `expanded`: 10
- `added`: 26, 27, 28, 29, 30, 31, 32, 33, 34
- `corrected`: 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 25 (mapeamento de camada reescrito) + 27, 29, 31, 33 já contados acima como `added` com evidência corrigida
- `preserved`: 1, 2, 3, 4, 5, 6, 13, 19, 24

### 4. Classificações

`5 + 19 + 0 + 10 = 34` — **confirmado**, recontado diretamente da matriz. Nenhuma unidade classificada como `unsupported`. Unidades com `insufficient_evidence` por dependerem de leitura de runtime ou de buckets: **10, 21, 27, 33** (áudio, bateria, idempotência em execução).

### 5. Marcadores transversais

`scenographic: [15,21]` e `high_risks: [7,8,9,10,19,22,24,29,30,32,33]` conferem com a matriz.

`risk_annotations_total: 34` é ambíguo e deve ser desmembrado:
- **34 campos de risco não vazios** (coluna obrigatória, IDs 1–34) — esta é a leitura correta;
- **13 unidades com marcador transversal** `risk`/`high_risk` de severidade alta: os 11 `high_risks` acima. Misturar as duas métricas é o defeito; o R4 deve declarar `risk_annotation_definition: non_empty_risk_column` e listar as duas séries separadamente.

### 6. Decisões

`18 + 6 − 2 = 22` fecha aritmeticamente. Semanticamente:
- **10** — nova decisão legítima: §8.4 exige escolher onde mora a chave de idempotência e o TTL do lease; nada equivalente existe no código (grep sem ocorrências de lease/idempotency_key).
- **22** — legítima: `isQuietNow` usa `new Date().getHours()` do runtime (verificado em `src/lib/push.server.ts`), logo a fonte autoritativa de fuso é decisão de operador.
- **33, 34** — legítimas: limites do orçamento sensorial e escopo/ciclo dos Estúdios não têm implementação que os determine.
- **24** — legítima: escolher runner e escopo mínimo de testes (0 arquivos de teste, sem script `test`).
- **32** — legítima: dono da governança e periodicidade da auditoria das funções SECURITY DEFINER.
- **23 (observabilidade) e 25 (acessibilidade)** — a remoção **não está sustentada**. "Remanejamento com efeito líquido zero" não é justificativa; ambas continuam exigindo escolha de operador (stack de métricas/tracing em 23; nível-alvo WCAG em 25) e nenhuma evidência mostra essas escolhas já fixadas.

**Correção prescrita:** reinserir 23 e 25 → `decisions_required: 24`, com `decision_ids_final: [1,3,5,7,10,11,12,14,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34]`.

### 7. Mapeamentos de camada

Os três documentos R8 (Instruções Canônicas, Documento Unificado, Prompts Sequenciais) **não estão presentes no workspace** — `ls` em raiz e em `.lovable/` não os encontra. Sem os Prompts Sequenciais como fonte canônica é impossível citar o identificador e o título literal de cada camada e decidir entre o destino do comando R2 e o do R3.

Portanto: `future_layer_mapping_corrections: 18` **não pode ser confirmado** — a contagem de IDs bate, a reconciliação semântica fica `insufficient_evidence`, o mesmo valendo para `33 → P9.3` e `34 → P8.0/P10.0`. Divergência R2 vs R3 registrada como **não resolvida**, não como erro de nenhum dos lados.

### 8. Evidências revalidadas

`file_evidence`: 87 migrations, 38 arquivos em `_authenticated/`, 0 testes, sem script `test`, `isQuietNow` sem fuso, `audio/webm` transmitido em `ia.tsx:177`, sem ocorrências de lease/idempotency_key (as ocorrências de "claims" são JWT em `auth-middleware.ts`).
Métrica de loading: a contagem por grep muda conforme o padrão (77 linhas com `loading` em `.tsx` nesta execução, contra 51 relatadas) — é **aproximada e não comparável**, deve ser marcada como inferência.
`current_database_evidence` (85 tabelas, 179 policies, 54 funções, 45 SECURITY DEFINER, 0 views, 100% RLS): estado atual do banco, **não snapshot histórico** do SHA de P0.1 — qualificação já correta no R3 e mantida.
`insufficient_evidence`: ausência de persistência de áudio em storage (não inspecionada por bucket), idempotência em runtime, orçamento sensorial e ciclo dos Estúdios em execução.

### 9. Cobertura canônica

§8.4 pela unidade 10, §9.5 pela 33, §10.5 pela 34, §9.6 transversal (22, 29, 33), §16–§20 como meta-programa: tratamento correto. `remaining_coverage_gaps: []` confirmado quanto às cláusulas, ressalvado que a verificação literal contra os documentos R8 não pôde ser refeita nesta camada (documentos ausentes do workspace).

### 10. Gates registrados (não executados)

Persistência dos três documentos R8 antes de P1.0: **pendente e agora bloqueante para a validação de mapeamentos**. P0.3 estritamente read-only. Build, lint e typecheck somente em P0.3. Testes mínimos, feature flags e rollback como gate bloqueante antes de P2.0. Congelamento da auditoria em P0.4.

### 11. Pacote de Validação

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R3
validation_result: partial
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_validated: edit/edt-6a98bef6-7138-485e-920e-23d7040c542a
head_validated: 2a4269401bc407ca408c367c96d3c0721ad126f1
head_reported_by_r3: 82d9ca0139e496180d1f6148a62c684add259dde
head_identity_note: "HEAD e branch declarados no R3 estao desatualizados; equivalencia de codigo permanece"
code_equivalence_confirmed: true
documental_deltas: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
documental_deltas_origin: pre_existing_between_p0_1_and_head
matrix_self_contained: true
coverage_units_total: 34
matrix_fields_per_unit: 13
unit_ids_complete_and_unique: true
repair_status_vocabulary_result: "hipotese A: 'materializado' e indicador editorial; status formal ausente; sem autorizacao documental para substituir preserved/expanded/added/corrected"
repair_status_corrections:
  preserved: [1,2,3,4,5,6,13,19,24]
  expanded: [10]
  added: [26,27,28,29,30,31,32,33,34]
  corrected: [7,8,9,11,12,14,15,16,17,18,20,21,22,23,25]
units_confirmed: [1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,22,23,24,25,26,28,29,30,31,32,34]
units_corrected: []
units_unsupported: []
units_with_insufficient_evidence: [10,21,27,33]
reusable: [2,11,12,17,20]
partial: [1,3,4,5,6,10,13,14,15,16,19,21,22,23,25,27,30,31,32]
incompatible: []
absent: [7,8,9,18,24,26,28,29,33,34]
classification_sum_check: "5 + 19 + 0 + 10 = 34 OK"
scenographic: [15,21]
high_risks: [7,8,9,10,19,22,24,29,30,32,33]
risk_annotation_definition: non_empty_risk_column
risk_annotation_item_ids: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
risk_annotations_total: 34
transversal_risk_marker_ids: [7,8,9,10,19,22,24,29,30,32,33]
transversal_risk_marker_total: 11
decision_ids_r1: [1,3,5,7,11,12,14,18,19,21,23,25,26,27,28,29,30,31]
decision_ids_added: [10,22,24,32,33,34]
decision_ids_removed: []
decision_ids_final: [1,3,5,7,10,11,12,14,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
decisions_required_recounted: 24
decision_change_justifications:
  10: "sustentada: §8.4 exige definir chave de idempotencia e TTL de lease; grep sem ocorrencias"
  22: "sustentada: isQuietNow usa getHours do runtime; fuso autoritativo indefinido"
  24: "sustentada: runner e escopo minimo de testes; 0 testes e sem script test"
  32: "sustentada: dono da governanca e periodicidade da auditoria de 45 SECURITY DEFINER"
  33: "sustentada: limites de custo/bateria e comportamento ao exceder"
  34: "sustentada: escopo global vs por usuario e ciclo canonico dos Estudios"
  23: "remocao NAO sustentada: stack de metricas/tracing continua sendo escolha de operador"
  25: "remocao NAO sustentada: nivel-alvo de acessibilidade continua sendo escolha de operador"
decision_count_resolution: "18 + 6 - 0 = 24; a subtracao de 23/25 no R3 e revertida por falta de justificativa concreta"
future_layer_mapping_ids: [7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,25,27,29]
future_layer_mapping_destinations: unresolved
future_layer_mapping_corrections_recounted: insufficient_evidence
r2_vs_r3_mapping_resolution: "indeterminado: os tres documentos R8, incluindo os Prompts Sequenciais, nao estao presentes no workspace; sem fonte canonica nao ha como arbitrar R2 vs R3 nem citar titulos literais de camada"
unit_10_validation: insufficient_evidence
unit_33_validation: insufficient_evidence
unit_34_validation: confirmed
remaining_coverage_gaps: []
evidence_corrections:
  - "branch e HEAD declarados no R3 divergem do estado atual; equivalencia de codigo intacta"
  - "'nenhuma operacao Git executada' -> 'nenhuma operacao Git mutativa executada'"
  - "linhas de loading: 77 nesta execucao contra 51 relatadas; metrica aproximada, marcar como inferencia"
  - "ocorrencias de 'claims' em auth-middleware.ts sao JWT, nao concorrencia; ausencia de lease/idempotency_key mantida"
  - "risk_annotations_total 34 = campos de risco nao vazios; marcadores transversais de alta severidade sao 11"
remaining_evidence_gaps:
  - "documentos R8 ausentes do workspace: leitura literal e reconciliacao de camadas impossiveis"
  - "ausencia de audio em storage verificada por grep, nao por inspecao de buckets"
  - "build, typecheck e lint nao executados (P0.3)"
  - "45 funcoes SECURITY DEFINER nao auditadas individualmente"
  - "runtime nao observado: idempotencia, latencia, bateria, temperatura, custo de IA"
git_identity_phrase_correction: "nenhuma operacao Git mutativa executada"
document_persistence_gate: pending_blocking_for_layer_mapping
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
  - "autorizar reparo editorial P0.2-R4"
  - "decidir sobre persistencia dos tres documentos R8, sem a qual os 18 mapeamentos permanecem irreconciliaveis"
  - "confirmar reinsercao das decisoes 23 e 25 (total 24)"
recommended_next_command: "REPARAR WIMI-R8 — P0.2-R4"
```

### Escopo do P0.2-R4 (somente editorial)

1. Atualizar branch/HEAD e a frase de identidade Git.
2. Substituir `materializado` pelo status formal por unidade.
3. Reinserir as decisões 23 e 25 e recontar para 24.
4. Desmembrar `risk_annotations_total` em coluna de risco (34) e marcadores transversais (11).
5. Marcar os 18 mapeamentos como `unresolved` até a persistência dos documentos R8.

P0.2 não aprovado. P0.3 não iniciado.
