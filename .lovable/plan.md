## Estado observado (somente leitura)

```yaml
branch: edit/edt-2b0a1a93-3932-4989-a0bf-a09144e0f9ae
head: bb5ea376a45b216a9f9235fa268698a5bbb53725
git_status_porcelain: ""   # árvore limpa
lovable_dir: [mcp/manifest.json, plan.md, project.json, wimi-r8-checkpoint.md]
```

Confirmações canônicas: P0.1 aprovado (registrado em `.lovable/wimi-r8-checkpoint.md`); P0.2 não aprovado; P0.3 não iniciado; `.lovable/plan.md` hoje contém **apenas** o plano da integração MCP — os textos literais de P0.2-R2/R3/R4 **não estão persistidos em arquivo** no repositório. `wimi-r8-checkpoint.md` cobre só P0.1.

## Evidências dos riscos técnicos do MCP (confirmadas)

| # | Risco | Evidência literal | Veredito |
|---|---|---|---|
| 1 | Rollback de XP divergente | `habit_logs_remove_xp AFTER DELETE → remove_habit_xp()` existe; em `user_mission_logs` só há `trg_user_mission_log_xp AFTER INSERT → award_user_mission_xp()`, **sem trigger de DELETE** | Confirmado: `undo_completion(kind:"mission")` apaga o log e **mantém o XP/brasas** |
| 2 | Integridade user/habit/mission | `user_mission_logs` tem FK só em `mission_id`; **não há FK de `user_id`** nem check de que a missão pertence ao usuário. RLS exige `auth.uid() = user_id`, mas não amarra o par | Confirmado (parcial): RLS impede cross-user leitura, não impede log com `mission_id` alheio |
| 3 | `plan_day` não atômico | `plan-day.ts:62-69` executa `update(... active:false)` sem capturar `error` e sem transação; o `insert` seguinte pode falhar deixando o dia **esvaziado** | Confirmado |
| 4 | Contratos código × banco | `title` cortado em `slice(0,160)` vs `user_missions_title_check ≤ 140`; `remind_before_min` só `Math.max(0,…)` vs check `0..240`; `notes` sem corte vs check `≤2000`; `end_time < scheduled_time` aceito; `area_slug` livre (banco não valida; `habits.area_slug` default `'corpo'`, divergente da lista `treino/cozinha/quarto/casa/mental/inclusao` das descrições); dias inválidos viram `127` (todos os dias) em `create-mission.ts:16-29` | Todos confirmados |
| 5 | `readOnlyHint: false` | Dica declarativa do protocolo; a confirmação humana depende do cliente MCP | Confirmado: não é controle de segurança |
| 6 | Classificação das ferramentas | Manifesto: 11 tools. Leitura pura: `get_profile`, `list_missions`, `list_habits`, `list_notifications` = **4**. Mutativas: `generate_nudges` (grava notificações), `create_habit`, `log_habit`, `create_mission`, `complete_mission`, `undo_completion`, `plan_day` = **7** | Confirmado (4/7) |

## A. Recuperação e persistência dos documentos R8

- **A1** — Criar `.lovable/r8/` com arquivos **novos**: `p0.1-approved.md`, `p0.2-r4.md`, `p0.2-r5.md`, `mcp-parallel-track.md`. Nada sobrescreve `wimi-r8-checkpoint.md` nem `plan.md`.
- **A2** — Mover o conteúdo atual de `.lovable/plan.md` para `.lovable/r8/mcp-parallel-track.md` **por cópia**, mantendo o original íntegro até o gate G1.
- **A3** — Registrar em `p0.2-r5.md` a fonte R2 como `unavailable_source — matriz literal não persistida; nenhuma reconstrução realizada` e preservar literalmente o bloco `r3_literal_future_layer_destinations` (18 IDs) fornecido pelo operador.
- Risco: perda dos únicos vestígios de R3/R4 se algum arquivo for sobrescrito. Evidência de conclusão: `git status` mostrando apenas adições em `.lovable/r8/`. Pré-requisito: gate **G1**. Deliberação humana: **sim**.

## B. Conclusão e validação de P0.2-R5

- **B1** — Redigir P0.2-R5 apenas como reparo documental: R2 = `unavailable_source`; R3 literal preservado; R4 e destinos canônicos dos Prompts Sequenciais preservados; vocabulário do campo 13 restrito a `preserved | expanded | added | corrected` sem anotações parentéticas.
- **B2** — Não recontar unidades nem alterar status de aderência; R5 é editorial.
- Evidência: documento autocontido com 34 unidades e a soma declarada. Pré-requisito: A1–A3. Deliberação: **sim** (validação `VALIDAR WIMI-R8 — P0.2-R5`). P0.2 permanece `not_approved` até essa validação.

## C. Classificação da trilha MCP

- **C1** — Registrar a integração MCP como `parallel_unreconciled`: construída fora da sequência R8, **não** imputável a P0.3, que segue `not_started`.
- **C2** — Registrar "Weme" como identidade técnica provisória; canônico é **WIMI**; "Vertical Vision" é alias legado. A renomeação (título em `src/lib/mcp/index.ts`, descrições das tools, manifesto) fica **pendente de deliberação**, não é executada agora.
- Risco: consolidar retroativamente a trilha como camada aprovada. Evidência: seção explícita em `mcp-parallel-track.md`.

## D. Reparos técnicos do MCP (somente após gate G2)

| Etapa | Alvo | Ação |
|---|---|---|
| D1 | migration | Trigger `AFTER DELETE ON user_mission_logs` espelhando `remove_habit_xp()` para estornar XP/brasas da missão |
| D2 | migration | FK `user_mission_logs.user_id → auth.users` + check de coerência (missão pertence ao mesmo usuário), via função `SECURITY DEFINER` ou trigger de validação |
| D3 | migration | RPC `plan_day_replace(_blocks jsonb)` transacional: arquiva `one_off` do dia e insere os novos em uma única transação |
| D4 | `src/lib/mcp/tools/create-mission.ts`, `plan-day.ts` | `title` → 140; `notes` → 2000; `remind_before_min` clamp 0..240; rejeitar `end_time <= scheduled_time`; validar `area_slug` contra lista canônica; rejeitar dias inválidos em vez de cair para 127 |
| D5 | `plan-day.ts` | Passar a chamar a RPC de D3 e propagar erro do arquivamento |
| D6 | `src/lib/mcp/index.ts`, `.lovable/mcp/manifest.json` | Reextrair manifesto; documentar que 7 tools são mutativas e que `generate_nudges` escreve |

Risco de D1/D2: migrations tocam economia de XP e dados existentes — exigem revisão de linhas órfãs antes de aplicar a FK. Evidência: manifesto regenerado sem erro + queries de verificação.

## E. Testes exigidos antes de qualquer publicação

E1 contrato (títulos longos, notas longas, lembrete 999, horário invertido, `area_slug` inválido, dias inválidos); E2 RLS (`mission_id` de outro usuário deve ser rejeitado); E3 atomicidade (`plan_day` com falha no meio não pode zerar o dia); E4 autenticação (token sem `client_id` rejeitado; sessão do app não serve); E5 rollback de XP (concluir → desfazer → saldo volta ao inicial, missão **e** hábito); E6 build, lint, typecheck; E7 runtime do endpoint `/mcp` com um cliente real.

## F. Gates humanos separados

- **G1** — autorizar alterações documentais (A, B, C).
- **G2** — autorizar reparo técnico e migrations (D).
- **G3** — autorizar conexão de ferramentas mutativas a clientes MCP externos.
- **G4** — autorizar publicação/deploy.

Nenhum gate é implícito; G2 não libera G3.

## Matriz de preservação (o que não pode ser perdido)

| Artefato | Preservar integralmente |
|---|---|
| `.lovable/wimi-r8-checkpoint.md` | SHA canônico `a4db78b`, supersessão de `22128b92`, inventário (87 migrations, 85 tabelas, 179 policies, 54 funções, 45 SECURITY DEFINER, 0 views, 0 testes) e o gate P0.1 `pass` |
| `.lovable/plan.md` | Conteúdo atual do plano MCP — copiar antes de qualquer substituição |
| R2 | Registro explícito de `unavailable_source`; **nenhuma** reconstrução |
| R3 | Os 18 pares literais `id → camada` fornecidos |
| R4 | 34 unidades, 13 campos, 24 decisões, vocabulário de status, `future_layer_mapping_ids_total: 18`, `remaining_mapping_gaps: []` |
| Implementação MCP | 11 tools, OAuth por `VITE_SUPABASE_PROJECT_ID`, `supabaseForUser` (sem service role), consent route `[.]lovable.oauth.consent.tsx`, rotas geradas pelo plugin |

## Pacote de retorno

```yaml
result: planned
mode: plan_only
files_changed: []
database_changed: false
code_changed: false
p0_2_status: not_approved
p0_3_status: not_started
mcp_integration_status: parallel_unreconciled
ready_for_document_repair: true
ready_for_technical_repair: false   # depende de G2
human_gates_required: [G1_documental, G2_tecnico, G3_ferramentas_mutativas, G4_publicacao]
recommended_next_command: "REPARAR WIMI-R8 — P0.2-R5 (documental, gate G1 autorizado)"
```
