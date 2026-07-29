> Documento chat-only, não mutativo. Nenhum arquivo, migration, banco, teste, build ou deploy foi tocado. HEAD preservado: `8936df6b8cc94e7f124e0fd2e7dea2fe2923c993`.

## 1. repair_result

```
repair_result: repaired_ready_for_validation
```

7/7 divergências fechadas por overlay composicional. Nenhuma decisão em aberto, nenhum placeholder, nenhuma alternativa "A ou B".

## 2. identity_and_base

```yaml
program_id: WIMI-3.7-R8
layer: P0.3
revision: R5
emission_kind: normative_overlay
base_candidate: main:agent#00000000540809#don:MDPNJKXU   # P0.3-R4 final
canonical_validation: main:agent#00000000544361#don:SRSB3PQE
superseded_not_usable:
  - P0.3-R4 emissão 1 (superseded_failed_audit)
  - P0.3-R4 emissão 2 (superseded_failed_audit)
  - validação R4 #542282 (superseded_failed_audit)
head_expected: 8936df6b8cc94e7f124e0fd2e7dea2fe2923c993
head_observed: 8936df6b8cc94e7f124e0fd2e7dea2fe2923c993
lotes: 15 (mapa, DAG, títulos, fases e tetos de artefatos herdados sem alteração)
```

Fatos verificados por leitura read-only do banco nesta rodada (não alterados):
- `execution_events_kind_check` cobre apenas os 9 kinds legados — nenhum `segment_*`. Confirma que L10A precisa de migration de CHECK.
- `execution_events_phase_check` = `preEnd, atEnd, preStart` — sem `atStart`. Confirma o reparo herdado da R3/R4.
- `aggregate_execution_event` hoje **não** usa `search_path=public` isolado; o hardening do overlay G se aplica à recriação, sem regressão.

## 3. composition_rule

```
P0.3-R5_candidate := P0.3-R4_base (MDPNJKXU) + R5_overlay (este documento)
```

Regras normativas de composição, vinculantes para a validação:

1. Todo fragmento **não** listado no replacement_manifest permanece **normativamente idêntico** à base R4. Ausência aqui = herança, nunca revogação.
2. A validação deve **compor** base + overlay. Não pode exigir reemissão integral, quinta reprodução dos 15 lotes, nem persistência de artefatos em `.lovable/`.
3. Onde overlay e base conflitam **dentro** de um fragmento substituído, o overlay prevalece integralmente para aquele fragmento.
4. Onde o overlay é silente, a base prevalece — inclusive nos 9/9 reparos R4, 7/7 correções intra-R4 e 4/4 contratos restaurados (L08/L09/L12/L14).
5. Nenhum fragmento do overlay contém elipse, `...`, `TODO` ou texto ilustrativo: o DDL abaixo é executável como escrito.

## 4. replacement_manifest

| Lote | Título (herdado) | Status | Fragmentos substituídos |
|---|---|---|---|
| L01 | Fundamento de tipos e contratos base | inherited | — |
| L02 | Unions e tipos TS de jornada | changed | apenas unions de `reason` e tipo de retorno afetados por `segment_seq` |
| L03 | Telemetria base / idempotência de leitura | inherited | — |
| L04 | `client_event_id` em `execution_events` | changed | apenas rollback |
| L05 | Hardening de funções — camada 1 | changed | apenas `SET search_path` das funções criadas/substituídas |
| L06 | Imutabilidade de `execution_events` | changed | apenas `SET search_path` das funções criadas/substituídas |
| L07 | Hardening de funções — camada 2 | changed | apenas `SET search_path` das funções criadas/substituídas |
| L08 | `journey_execution` (schema R3) | changed | CHECK temporal, guard scope/timestamps, `search_path`, rollback atômico |
| L09 | Server functions de jornada | changed | validação fechada, UPDATE governado por trigger, tipos TS, `search_path` |
| L10A | Schema de segmentos em `execution_events` | changed | `segment_seq`, shape estrito, índices, helper, agregador, `search_path`, rollback atômico |
| L10B | Lifecycle de segmentos (RPCs) | changed | validação fechada, lifecycle por `segment_seq`, `search_path` |
| L11 | Push/manifestação da jornada | inherited | — |
| L12 | Grafo `journey_node` / `journey_edge` | changed | apenas rollback atômico |
| L13 | Integração de execução no app | inherited | — |
| L14 | `journey_reflection` | changed | validação fechada, lock no guard, `search_path`, rollback atômico |
| §6.2 | Rollback global 15→01 | changed | preflight-before-teardown |

Lotes materialmente intocados: **L01, L03, L05*, L06*, L07*, L11, L13** — sendo L05/L06/L07 alterados exclusivamente na cláusula `SET search_path` (hardening global, sem drift de lógica, assinatura, grants ou ordem). Contam como 8/15 sem drift material junto a L01/L03/L11/L13.

## 5. R5_overlay

### 5.A — V-R4-05 · Rollback atômico (L04, L08, L10A, L12, L14)

Forma canônica única, aplicada aos cinco lotes: **uma transação**, `LOCK ... IN ACCESS EXCLUSIVE MODE` em ordem determinística, **todos** os preflights sob o lock, `RAISE EXCEPTION` antes de qualquer teardown, `CASCADE` proibido.

**L04 — rollback**

```sql
BEGIN;
LOCK TABLE public.execution_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.execution_events WHERE client_event_id IS NOT NULL) THEN
    RAISE EXCEPTION 'L04 rollback blocked: client_event_id in use';
  END IF;
END $$;
DROP INDEX IF EXISTS public.execution_events_client_event_uidx;
ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_client_event_id_len;
ALTER TABLE public.execution_events DROP COLUMN IF EXISTS client_event_id;
COMMIT;
```

**L08 — rollback** (pressupõe L14/L12/L10A já revertidos pela ordem global)

```sql
BEGIN;
LOCK TABLE public.journey_execution IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.journey_execution) THEN
    RAISE EXCEPTION 'L08 rollback blocked: journey_execution not empty';
  END IF;
  IF EXISTS (SELECT 1 FROM public.execution_events WHERE journey_execution_id IS NOT NULL) THEN
    RAISE EXCEPTION 'L08 rollback blocked: execution_events still reference journey_execution';
  END IF;
END $$;
DROP TRIGGER IF EXISTS journey_execution_guard_trg ON public.journey_execution;
DROP FUNCTION IF EXISTS public.journey_execution_guard();
DROP POLICY IF EXISTS journey_execution_select_own ON public.journey_execution;
DROP POLICY IF EXISTS journey_execution_insert_own ON public.journey_execution;
DROP INDEX IF EXISTS public.journey_execution_user_status_idx;
ALTER TABLE public.journey_execution DROP CONSTRAINT IF EXISTS journey_execution_time_order;
ALTER TABLE public.journey_execution DROP CONSTRAINT IF EXISTS journey_execution_status_check;
DROP TABLE IF EXISTS public.journey_execution;
-- wimi_execution_lock_key preservada: consumida por L10A/L10B/L14; removida somente no rollback de L01/L05.
COMMIT;
```

**L10A — rollback** (dois preflights juntos, no início)

```sql
BEGIN;
LOCK TABLE public.execution_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.execution_events
    WHERE journey_execution_id IS NOT NULL OR segment_id IS NOT NULL OR segment_seq IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'L10A rollback blocked: segment columns in use';
  END IF;
  IF EXISTS (SELECT 1 FROM public.execution_events WHERE kind LIKE 'segment\_%') THEN
    RAISE EXCEPTION 'L10A rollback blocked: segment kinds present';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.journey_has_open_segment(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.aggregate_execution_event() -- corpo pré-L10A, sem guarda segment_*
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RETURN NEW; END $$;
DROP POLICY IF EXISTS execution_events_insert_no_segment_kinds ON public.execution_events;
DROP INDEX IF EXISTS public.execution_events_segment_seq_uidx;
DROP INDEX IF EXISTS public.execution_events_segment_lookup_idx;
ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_segment_shape;
ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_journey_execution_fk;
ALTER TABLE public.execution_events DROP COLUMN IF EXISTS segment_seq;
ALTER TABLE public.execution_events DROP COLUMN IF EXISTS segment_id;
ALTER TABLE public.execution_events DROP COLUMN IF EXISTS journey_execution_id;
ALTER TABLE public.execution_events DROP CONSTRAINT IF EXISTS execution_events_kind_check;
ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_kind_check
  CHECK (kind = ANY (ARRAY['manifest_shown','manifest_ack','mission_done','mission_skipped',
    'mission_extended','mission_started','mission_ended','voice_note','negotiation']));
COMMIT;
```

**L12 — rollback** (ordem explícita e única: `journey_edge` → `journey_node`)

```sql
BEGIN;
LOCK TABLE public.journey_edge IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.journey_node IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.journey_edge) THEN RAISE EXCEPTION 'L12 rollback blocked: journey_edge not empty'; END IF;
  IF EXISTS (SELECT 1 FROM public.journey_node) THEN RAISE EXCEPTION 'L12 rollback blocked: journey_node not empty'; END IF;
END $$;
DROP INDEX IF EXISTS public.journey_edge_from_idx;
DROP INDEX IF EXISTS public.journey_node_exec_idx;
DROP TABLE IF EXISTS public.journey_edge;
DROP TABLE IF EXISTS public.journey_node;
COMMIT;
```

**L14 — rollback**

```sql
BEGIN;
LOCK TABLE public.journey_reflection IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.journey_reflection) THEN
    RAISE EXCEPTION 'L14 rollback blocked: journey_reflection not empty';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.journey_reflection_save(uuid, text, boolean, integer);
DROP TRIGGER IF EXISTS journey_reflection_guard_trg ON public.journey_reflection;
DROP FUNCTION IF EXISTS public.journey_reflection_guard();
DROP POLICY IF EXISTS journey_reflection_select_own ON public.journey_reflection;
DROP INDEX IF EXISTS public.journey_reflection_exec_uidx;
ALTER TABLE public.journey_reflection DROP CONSTRAINT IF EXISTS journey_reflection_execution_fk;
DROP TABLE IF EXISTS public.journey_reflection;
COMMIT;
```

### 5.B — V-R4-06 · Domínio fechado nas RPCs

Regra normativa: **validação de input precede lock, leitura de estado e escrita**; retorna `outcome='rejected'` com `reason` dentro do union. `CHECK`/`NOT NULL` nunca são caminho normal de validação. `anon` e `PUBLIC` permanecem sem `EXECUTE` (REVOKEs da base preservados); a exceção `unauthenticated` é defensiva e não os substitui.

Preâmbulo canônico, textual, inserido no topo de cada RPC:

```sql
-- journey_execution_transition
IF _execution IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_execution_id'); END IF;
IF _to_status IS NULL OR _to_status NOT IN ('active','paused','completed','cancelled')
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_to_status'); END IF;

-- journey_segment_start
IF _execution IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_execution_id'); END IF;
IF _client_event_id IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','client_event_id_required'); END IF;
IF length(_client_event_id) < 8 OR length(_client_event_id) > 128
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_client_event_id'); END IF;

-- journey_segment_event
IF _execution IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_execution_id'); END IF;
IF _segment IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','segment_id_required'); END IF;
IF _kind IS NULL OR _kind NOT IN ('segment_paused','segment_resumed','segment_ended')
  THEN RETURN jsonb_build_object('outcome','rejected','reason','unsupported_kind'); END IF;
IF _client_event_id IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','client_event_id_required'); END IF;
IF length(_client_event_id) < 8 OR length(_client_event_id) > 128
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_client_event_id'); END IF;

-- journey_reflection_save
IF _execution IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_execution_id'); END IF;
IF _rest_needed IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_reflection_payload'); END IF;
IF _reflection_text IS NOT NULL AND (btrim(_reflection_text) = '' OR length(_reflection_text) > 2000)
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_reflection_payload'); END IF;
IF (_rest_needed AND (_rest_minutes IS NULL OR _rest_minutes < 1 OR _rest_minutes > 1440))
   OR ((NOT _rest_needed) AND _rest_minutes IS NOT NULL)
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_reflection_payload'); END IF;
IF _reflection_text IS NULL AND NOT _rest_needed
  THEN RETURN jsonb_build_object('outcome','rejected','reason','invalid_reflection_payload'); END IF;
```

**L02 — union de `reason` (substituição integral do fragmento):**

```ts
export type JourneyRejectReason =
  | "unauthenticated" | "not_found" | "forbidden"
  | "invalid_execution_id" | "invalid_to_status"
  | "invalid_transition" | "open_segment_present"
  | "client_event_id_required" | "invalid_client_event_id"
  | "segment_id_required" | "unsupported_kind"
  | "segment_not_found" | "segment_already_ended"
  | "execution_not_completed" | "invalid_reflection_payload";

export type JourneyOutcome<T> =
  | { outcome: "ok"; data: T }
  | { outcome: "duplicate"; data: T }
  | { outcome: "rejected"; reason: JourneyRejectReason };
```

Sem sinonímia: cada `reason` do SQL aparece uma única vez no union, com grafia idêntica.

### 5.C — V-R4-07 · `segment_seq` monotônico (L10A/L10B)

Solução única adotada: coluna `segment_seq bigint NULL` em `execution_events`. **Nenhuma tabela própria de segmentos.** UUID e `occurred_at` deixam de ter qualquer papel de ordenação.

```sql
ALTER TABLE public.execution_events ADD COLUMN segment_seq bigint;

CREATE UNIQUE INDEX execution_events_segment_seq_uidx
  ON public.execution_events (segment_id, segment_seq)
  WHERE segment_id IS NOT NULL;

CREATE INDEX execution_events_segment_lookup_idx
  ON public.execution_events (user_id, journey_execution_id, segment_id, segment_seq DESC)
  WHERE segment_id IS NOT NULL;
```

`journey_segment_start`: gera `segment_id` no servidor (`gen_random_uuid()`) e insere `segment_started` com `segment_seq = 1`.

`journey_segment_event`, após validação fechada, após `pg_advisory_xact_lock(public.wimi_execution_lock_key(_execution))` e `pg_advisory_xact_lock(public.wimi_segment_lock_key(_segment))`, e **após** a checagem de idempotência por `client_event_id`:

```sql
SELECT segment_seq, kind INTO _last_seq, _last_kind
FROM public.execution_events
WHERE user_id = _uid AND journey_execution_id = _execution AND segment_id = _segment
ORDER BY segment_seq DESC
LIMIT 1;
IF _last_seq IS NULL THEN RETURN jsonb_build_object('outcome','rejected','reason','segment_not_found'); END IF;
IF _last_kind = 'segment_ended' THEN RETURN jsonb_build_object('outcome','rejected','reason','segment_already_ended'); END IF;
_next_seq := _last_seq + 1;
```

`journey_has_open_segment(_uid uuid, _execution uuid, _segment uuid)` decide terminalidade pelo `kind` da linha de maior `segment_seq` — nunca por `occurred_at` nem por `id`. `segment_ended` é terminal; novo ciclo exige novo `segment_id` gerado pelo banco.

### 5.D — V-R4-08 · Guard temporal completo (L08/L09)

```sql
ALTER TABLE public.journey_execution ADD CONSTRAINT journey_execution_time_order
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at);

CREATE OR REPLACE FUNCTION public.journey_execution_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(public.wimi_execution_lock_key(OLD.id));
  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'journey_execution: identity is immutable'; END IF;
  IF NEW.scope IS DISTINCT FROM OLD.scope THEN
    RAISE EXCEPTION 'journey_execution: scope is immutable'; END IF;
  IF NEW.status = 'active' AND OLD.status <> 'active' AND OLD.started_at IS NULL THEN
    NEW.started_at := pg_catalog.now();
  ELSIF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'journey_execution: started_at is write-once';
  END IF;
  IF NEW.status IN ('completed','cancelled') AND OLD.status NOT IN ('completed','cancelled') THEN
    NEW.ended_at := pg_catalog.now();
  ELSIF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
    RAISE EXCEPTION 'journey_execution: ended_at is set only on terminal transition';
  END IF;
  IF NEW.status IN ('completed','cancelled')
     AND public.journey_has_open_segment(OLD.user_id, OLD.id, NULL) THEN
    RAISE EXCEPTION 'journey_execution: open segment present';
  END IF;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END $$;
```

O trigger é **autoridade única** sobre `started_at`/`ended_at`. `journey_execution_transition` (L09) passa a executar `UPDATE public.journey_execution SET status = _to_status WHERE id = _execution AND user_id = _uid` — apenas `status`. Owner e `service_role` não contornam: o trigger dispara em todo `UPDATE`.

### 5.E — V-R4-09 · Shape estrito (L10A)

```sql
ALTER TABLE public.execution_events ADD CONSTRAINT execution_events_segment_shape CHECK (
  (kind LIKE 'segment\_%' AND journey_execution_id IS NOT NULL
     AND segment_id IS NOT NULL AND segment_seq IS NOT NULL AND segment_seq > 0)
  OR
  (kind NOT LIKE 'segment\_%' AND journey_execution_id IS NULL
     AND segment_id IS NULL AND segment_seq IS NULL)
);
```

Toda consulta de "último evento" filtra obrigatoriamente por `user_id`, `journey_execution_id = _execution` e `segment_id`.

### 5.F — V-R4-10 · Reflexão sem TOCTOU (L14)

```sql
CREATE OR REPLACE FUNCTION public.journey_reflection_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE _owner uuid; _status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(public.wimi_execution_lock_key(NEW.journey_execution_id));
  SELECT user_id, status INTO _owner, _status
    FROM public.journey_execution WHERE id = NEW.journey_execution_id;
  IF _owner IS NULL OR _owner <> NEW.user_id THEN
    RAISE EXCEPTION 'journey_reflection: owner mismatch'; END IF;
  IF _status <> 'completed' THEN
    RAISE EXCEPTION 'journey_reflection: execution not completed'; END IF;
  RETURN NEW;
END $$;
```

`pg_advisory_xact_lock` é reentrante na mesma transação: chamada via `journey_reflection_save` (que já detém o lock) não deadlocka.

### 5.G — V-R4-11 · `search_path` global

Toda função **criada ou substituída** por P0.3 — incluindo `aggregate_execution_event` ao ser recriada em L10A e no rollback de L10A, e as funções de L05/L06/L07 — carrega literalmente:

```sql
SET search_path = pg_catalog, public, pg_temp
```

com `pg_temp` explicitamente por último. Objetos não-`pg_catalog` são qualificados (`public.`). Nenhum DDL executável do overlay contém `SET search_path = public` isolado. REVOKEs e GRANTs da base são preservados sem alteração.

## 6. dependency_and_rollback_delta

DAG e ordem global preservados. §6.2 é substituída apenas na semântica de execução:

- **Antes (R4):** "abortar para depois de desmontar" — teardown podia iniciar antes da checagem completa.
- **Agora (R5):** **preflight-before-teardown**. Por lote: `BEGIN` → `LOCK ACCESS EXCLUSIVE` em ordem determinística → **todos** os preflights → `RAISE EXCEPTION` (aborta, estado contrato-equivalente ao anterior) **ou** teardown integral → `COMMIT`. Sem `CASCADE`.
- Ordem global reversa inalterada: **15 → 14 → 13 → 12 → 11 → 10B → 10A → 09 → 08 → 07 → 06 → 05 → 04 → 03 → 02 → 01**. É ela que garante o preflight de L08 (`execution_events.journey_execution_id` já nulo, pois L10A veio antes).
- `wimi_execution_lock_key` e `wimi_segment_lock_key` sobrevivem a L08 e só caem no rollback da camada que as criou, quando não há consumidores.

## 7. adversarial_proof_matrix

| # | Cenário adversarial | Resultado esperado | Mecanismo |
|---|---|---|---|
| 1 | Rollback bloqueado em L04/L08/L10A/L12/L14 | zero teardown; estado anterior contrato-equivalente | preflight sob `ACCESS EXCLUSIVE` + `RAISE EXCEPTION` antes do primeiro DROP, tudo em uma transação |
| 2a | `_to_status = NULL` | `rejected/invalid_to_status`, sem SQLSTATE 23514 | preâmbulo 5.B antes de lock |
| 2b | `_kind = NULL` | `rejected/unsupported_kind` | idem |
| 2c | `_segment = NULL` | `rejected/segment_id_required` | idem |
| 2d | `client_event_id` de 0, 7 e 129 chars | 0 e 7 → `invalid_client_event_id`; 129 → `invalid_client_event_id` (NULL → `client_event_id_required`) | `length()` 8..128 |
| 2e | reflexão `rest_needed=true, rest_minutes=NULL`; `false, 30`; texto `"   "`; texto 2001 chars; payload vazio | todos `rejected/invalid_reflection_payload` | preâmbulo 5.B |
| 3 | Dois eventos com `occurred_at` idêntico e UUID em ordem inversa | terminalidade correta | ordenação exclusiva por `segment_seq DESC`; UUID/timestamp nunca desempatam |
| 4a | `service_role`/owner altera `scope` | `RAISE EXCEPTION scope is immutable` | trigger 5.D |
| 4b | Reescrita de `started_at` fora da primeira ativação | `write-once` | trigger 5.D |
| 4c | `ended_at` fora da transição terminal | exceção | trigger 5.D |
| 5 | Evento não-segmento com `journey_execution_id` preenchido | rejeitado pelo CHECK | `execution_events_segment_shape` |
| 6 | INSERT direto de reflexão concorrente com cancelamento da execução | serializado; um dos dois falha coerentemente | mesmo `wimi_execution_lock_key` no guard da reflexão e no guard da execução |
| 7 | Busca textual no DDL executável do overlay | zero ocorrência de `search_path = public` isolado; `pg_temp` sempre último | §5.G |
| 8 | Auditoria negativa de drift | ver §8 | composition_rule |

## 8. preserved_contracts_audit

| Item | Verificação | Resultado |
|---|---|---|
| L01/L03/L11/L13 | não aparecem no manifest | herdados, zero drift |
| L05/L06/L07 | alterados só na cláusula `search_path` | lógica, assinaturas, ordem e grants herdados |
| L08 | schema R3: **sem coluna `title`**; FK e índice canônicos preservados | ok — overlay adiciona apenas CHECK temporal e guard |
| L09 | **3 server functions** (`create`, `transition`, `log`); `src/lib/execution.functions.ts` intocado | ok |
| L10A | shape/índices/CHECK alterados; nenhuma tabela de segmentos criada | ok |
| L10B | 3 kinds de evento de segmento; superfície preservada | ok |
| L12 | schema, policies e contratos **intocados**; só rollback | ok |
| L14 | `reflection_text`, `rest_needed`, `rest_minutes` e os **3 CHECKs** preservados | ok |
| 9/9 reparos R4 | nenhum revogado pelo overlay | preservados |
| 7/7 correções intra-R4 | nenhuma revogada | preservadas |
| 4/4 contratos restaurados (L08/L09/L12/L14) | alterados só nos pontos do manifest | preservados |
| Mapa de 15 lotes, DAG, títulos, fases, tetos de artefatos | não tocados | preservados |

## 9. state_packet

```yaml
program_id: WIMI-3.7-R8
layer: P0.3
revision: R5
emission_kind: normative_overlay
repair_result: repaired_ready_for_validation
base_candidate: main:agent#00000000540809#don:MDPNJKXU
canonical_validation_input: main:agent#00000000544361#don:SRSB3PQE
divergences_closed: 7/7   # V-R4-05..V-R4-11
lotes_total: 15
lotes_changed: 11   # L02,L04,L05,L06,L07,L08,L09,L10A,L10B,L12,L14
lotes_inherited_no_material_drift: 8   # L01,L03,L11,L13 + L05,L06,L07 (search_path-only) + L02 (union-only)
r4_repairs_preserved: 9/9
intra_r4_corrections_preserved: 7/7
restored_contracts_preserved: 4/4
open_decisions: 0
placeholders: 0
alternatives_left_open: 0
p0_3_status: planned_not_approved
p0_3_approved: false
p0_4_started: false
p1_started: false
p2_started: false
mcp_reconciliation: not_performed
head_expected: 8936df6b8cc94e7f124e0fd2e7dea2fe2923c993
head_observed: 8936df6b8cc94e7f124e0fd2e7dea2fe2923c993
files_changed: []
edit_id: null
commit_created: false
code_changed: false
database_changed: false
migrations_applied: false
tests_executed: false
deploy_executed: false
artifacts_persisted: false
ready_for_validation: true
recommended_next_command: "VALIDAR WIMI-R8 — P0.3-R5 (compor base MDPNJKXU + overlay R5; não exigir reemissão integral nem persistência)"
```
