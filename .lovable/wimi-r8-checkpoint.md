# WIMI-3.7-R8 — Registro Canônico de Checkpoint

Documento administrativo. Não altera código, banco, dependências ou configuração.

## Checkpoint canônico vigente (opção A, decidida pelo operador)

```yaml
program_id: WIMI-3.7-R8
canonical_branch: edit/edt-73feb652-bec2-4078-99fb-9cf407eeb0c8
canonical_sha: a4db78bde11018d44c3be0ae8507b661acae9a06
supersedes_sha: 22128b925f7c6e3f764ba50d70285f7427de918e
superseded_branch_ref: edit/edt-e72de014-f0d2-46ce-b6d4-e297af33386f @ 3124a6b1ecb898951dc6500bf2c7ce2463150148
superseded_branch_remote: absent
reconciliation_type: administrative
code_equivalence_confirmed: true
```

### Justificativa factual

- `22128b92` é ancestral de `a4db78b` (`git merge-base --is-ancestor` → 0).
- `git diff --name-status 22128b92..HEAD` retorna exatamente uma linha: `M .lovable/plan.md`.
- Diff restrito a `src supabase package.json bun.lock vite.config.ts tsconfig.json public` é vazio: código, migrations, dependências e configurações são idênticos.
- `a4db78b` coincide com o HEAD do workspace, com `main` local e com `origin/main` — único ponto com contraparte remota.
- `edit/edt-e72de014-…` existe apenas localmente (`git ls-remote --heads origin` lista somente `main` e `lovable-backup-main-1784139228`).

### Operações explicitamente não realizadas

Nenhum checkout, merge, rebase, commit, push, criação ou remoção de branch. `git status --porcelain` vazio antes e depois da validação.

## Inventário canônico P0.1 (valores reverificados)

### (a) Evidência por inspeção de arquivos

| Métrica | Valor |
|---|---|
| Migrations (`supabase/migrations/*.sql`) | 87 |
| Rotas autenticadas (`src/routes/_authenticated/*.tsx`) | 37 rotas + `route.tsx` (gate) = 38 arquivos |
| Rotas API (`src/routes/api/*.ts`) | 7 |
| Hooks públicos (`src/routes/api/public/hooks/*.ts`) | 3 |
| Arquivos de teste (`*.test.*`, `*.spec.*`) | 0 |
| Script `test` em `package.json` | ausente |

### (b) Evidência por consulta ao banco

| Métrica | Valor |
|---|---|
| Tabelas em `public` | 85 |
| Tabelas com RLS habilitado | 85 (100%) |
| Policies RLS em `public` | 179 |
| Funções em `public` | 54 |
| Funções `SECURITY DEFINER` | 45 |
| Views em `public` | 0 |

Correções sobre o Pacote de Retorno A1: tabelas 86 → 85; funções 55 → 54; policies e views não haviam sido informadas.

### (c) Inferência ainda não executada ou comprovada

- `build`, `typecheck` e `lint` não executados nesta camada.
- Ausência total de suíte de testes automatizados (0 arquivos, sem runner configurado).
- Idempotência de eventos, políticas de retenção, acessibilidade, custo/latência/consumo de bateria e comportamento em runtime não verificados.
- As leituras de banco refletem o ambiente atual; não são um snapshot do estado em `22128b92` (a identidade das migrations torna a equivalência plausível, não provada).

## Status do gate

```yaml
layer: P0.1
status: pass
approval_basis: administrative_reconciliation
note: aprovação decorre da equivalência de código confirmada e da adoção do checkpoint da opção A, não de nova inspeção de código
open_items_for_next_layer:
  - executar build, typecheck e lint
  - ausência de suíte de testes
  - verificações de runtime (idempotência, retenção, acessibilidade, custo/latência/bateria)
ready_for_next_layer: true
next_command: EXECUTAR WIMI-R8 — P0.2
```
