## REPARAR WIMI-R8 — P0.2-R5 — resultado: `blocked`

Operação estritamente em leitura. Nenhum arquivo criado, alterado, movido ou removido; **nenhuma operação Git mutativa executada**; nenhum build, lint ou typecheck; P0.2 não aprovado; P0.3 não iniciado.

### 1. Identidade Git e não mutação (verificada nesta rodada)

| Item | Valor observado |
|---|---|
| branch no início e no fim | `edit/edt-7388c479-e6d1-47a1-b4e8-0759b999685b` |
| HEAD no início e no fim | `fd6faf8e6f9c694da366883a1c29af3a3dd945b5` |
| `head_last_validated` informado no prompt | `c6e4f6ad…` (ancestral; a plataforma reabriu em nova branch — divergência registrada, não corrigida) |
| `git status --porcelain` antes / depois | vazio / vazio |
| deltas documentais preexistentes vs. `a4db78b` | `M .lovable/plan.md`, `A .lovable/wimi-r8-checkpoint.md` |
| diff restrito a `src supabase package.json bun.lock vite.config.ts tsconfig.json public` | vazio → equivalência de código com P0.1 confirmada |
| arquivos tocados nesta operação | nenhum |

Working tree limpo, deltas documentais preexistentes entre P0.1 e HEAD e arquivos tocados nesta operação são três coisas distintas — e apenas a terceira é vazia por ação desta rodada.

### 2. Verificação de fontes — uma fonte obrigatória está indisponível

Acessíveis e lidas integralmente:

- os três documentos R8 anexados (Instruções Canônicas, Documento Unificado, Prompts Sequenciais);
- `.lovable/wimi-r8-checkpoint.md`;
- a validação P0.2-R4 integral, materializada em `.lovable/plan.md` (matriz de 34 unidades, partição de status, listas de risco, decisões, mapeamentos).

**Indisponíveis:** os **destinos literais por ID** das matrizes **P0.2-R2** e **P0.2-R3**. Os corpos desses dois reparos foram entregues como planos não persistidos: não estão no repositório (`.lovable/plan.md` contém apenas a validação R4) e o histórico de chat conserva somente sumários das mensagens #386–#394 — que registram agregados ("17 correções de mapeamento" em R2; "18 correções" em R3), **não** o destino literal de cada um dos 18 IDs em cada revisão.

O item 5 deste prompt exige uma tabela com as colunas "destino literal em R2" e "destino literal em R3" para os IDs `[7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,25,27,29]`, além de veredito por revisão. Sem os textos originais, preencher essas duas colunas seria reconstrução por memória — expressamente proibida pelo prompt. Por isso a rodada é `blocked` e **nenhum** dos cinco reparos foi aplicado, inclusive os que seriam viáveis isoladamente (campo 13, decisões 29, marcador `risco`, divergência de P10.0), para não produzir uma entrega P0.2-R5 parcial que se apresentasse como completa.

### 3. Verificações que foi possível concluir sem reconstruir R2/R3

Confrontados diretamente contra os Prompts Sequenciais (arquivo anexado), os destinos canônicos finais listados no prompt são literais e corretos: P8.0 — Perfis e Estúdio de Presença (linha 573), P8.1 — Wake phrases simuladas (584), P9.1 — Transcrição Viva (612), P9.2 — Ambient Journal (623), P9.3 — Imagem e movimento (633), P10.1 — Duas vozes (660), P10.3 — Estúdios integrados (670).

**Divergência interna da fonte canônica, confirmada literalmente:**

```yaml
p10_0_source_title_status: source_inconsistent
p10_0_dependency_table_title: "Estudo vocal"     # linha 199, tabela de dependências
p10_0_section_heading_title: "Estudo técnico"    # linha 650, cabeçalho de seção
p10_0_identifier_stable: true
p10_0_note: "divergência editorial pertence à fonte canônica; nenhum dos dois títulos foi suprimido"
```

Confirma-se também que P10.0 (sob qualquer dos dois títulos) **não** é a camada dos Estúdios: os Estúdios integrados são P10.3 (linha 670), e a unidade 34 aponta para P8.0 + P10.3.

### 4. O que o operador precisa fornecer para desbloquear

Reanexar, como texto literal, qualquer um destes conjuntos:

1. a resposta integral do reparo **P0.2-R2** e a do reparo **P0.2-R3** (matrizes completas), **ou**
2. apenas as duas colunas exigidas: para cada um dos 18 IDs, o destino de camada futura como escrito em R2 e como escrito em R3.

Com essas colunas, os cinco reparos (matriz autocontida de 34 unidades com campo 13 saneado; decisões reconciliadas em 29 com demonstração dos IDs 8, 9, 15, 17 e 20; remoção do marcador solto `risco` em 1, 3 e 15; tabela comparativa R2 × R3 × R4; registro da divergência de P10.0) são executáveis em uma única rodada seguinte.

### Pacote de retorno

```yaml
program_id: WIMI-3.7-R8
layer: P0.2-R5
repair_attempt: 5
result: blocked
dependency_checkpoint: P0.1
dependency_checkpoint_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
branch_inspected_at_r5: edit/edt-7388c479-e6d1-47a1-b4e8-0759b999685b
head_last_validated: c6e4f6adf7898c9e6ead90ba1676301b985da3ac
head_inspected_at_r5: fd6faf8e6f9c694da366883a1c29af3a3dd945b5
head_identity_note: "head_last_validated é ancestral; plataforma reabriu em nova branch; divergência registrada, não corrigida"
sources_available: ["instrucoes_canonicas_r8", "documento_unificado_r8", "prompts_sequenciais_r8", ".lovable/wimi-r8-checkpoint.md", "validacao_p0.2-r4_integral"]
sources_missing: ["destinos literais por ID da matriz P0.2-R2", "destinos literais por ID da matriz P0.2-R3"]
blocking_reason: "item 5 exige destino literal em R2 e em R3 para 18 IDs; corpos de R2 e R3 não persistidos e não recuperáveis; reconstrução por memória proibida"
repairs_applied: []
matrix_self_contained: false
matrix_reissued: false
coverage_units_total: 34
matrix_fields_per_unit: 13
repair_status_vocabulary_result: not_repaired_blocked
repair_status_parenthetical_count: 19
units_preserved: [1,2,3,4,5,6,13,19,26,28,30,31]
units_expanded: [10]
units_added: [33,34]
units_corrected: [7,8,9,11,12,14,15,16,17,18,20,21,22,23,24,25,27,29,32]
decision_ids_r1: [1,3,5,7,11,12,14,18,19,21,23,25,26,27,28,29,30,31]
decision_ids_added: [8,9,10,15,17,20,22,24,32,33,34]
decision_ids_removed: []
decision_ids_final: [1,3,5,7,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]
decisions_required: 29
decision_count_resolution: "18 + 11 = 29 (adotado do prompt; não aplicado à matriz nesta rodada)"
newly_recognized_decisions_validation: not_performed_blocked
ambiguous_risk_marker_ids: [1,3,15]
ambiguous_risk_marker_status: not_repaired_blocked
transversal_high_risk_marker_total: 11
future_layer_mapping_ids_total: 18
dedicated_or_shared_layer_mapping_total: 16
no_dedicated_layer_ids: [23,25]
future_layer_mapping_resolved_total: 18
r2_vs_r3_vs_r4_comparison_materialized: false
future_layer_mapping_corrections_confirmed: 18
remaining_mapping_gaps: []
p10_0_source_title_status: source_inconsistent
p10_0_dependency_table_title: "Estudo vocal"
p10_0_section_heading_title: "Estudo técnico"
p10_0_identifier_stable: true
canonical_layer_titles_verified: true
remaining_coverage_gaps: []
document_persistence_gate: pending_before_P1.0
pre_p2_safety_gate: pending
code_equivalence_confirmed: true
documental_deltas_preexisting: ["M .lovable/plan.md", "A .lovable/wimi-r8-checkpoint.md"]
files_created: []
files_changed: []
code_changed: false
database_changed: false
git_status_before: clean
git_status_after: clean
no_mutative_commands_executed: true
no_changes_made: true
ready_for_validation: false
ready_for_approval: false
ready_for_next_layer: false
operator_decision_required:
  - "reanexar as matrizes integrais P0.2-R2 e P0.2-R3, ou apenas os destinos literais por ID das duas revisões"
  - "alternativamente, autorizar explicitamente a supressão das colunas R2 e R3 da tabela comparativa"
  - "confirmar o novo par branch/HEAD como contexto de inspeção"
recommended_next_command: "REATACH REQUIRED SOURCES — P0.2-R5"
```

P0.2 não aprovado. P0.3 não iniciado.
