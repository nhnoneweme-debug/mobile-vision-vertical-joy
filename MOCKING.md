# Modo Mock (rodar offline, sem Supabase)

Permite rodar o app **sem backend e sem login real**, com dados fake em memória. Serve para
desenvolver e testar a UI rapidamente. **Nada disso vai para produção** — é ativado só por
variável de ambiente e fica isolado na branch `develop`.

## Como rodar

```bash
npm install
npm run dev:mock      # = vite dev --mode mock  →  http://localhost:3000
```

O `--mode mock` carrega o arquivo `.env.mock` (que define `VITE_USE_MOCKS=true`). Ao abrir,
você já entra **logado como usuário fake** (`Demo Player`) e cai direto no `/mapa`, sem passar
pela tela de login.

> Para voltar ao modo normal (Supabase real), use `npm run dev` com um `.env` de verdade.

## Como funciona

```
client.ts  --(VITE_USE_MOCKS=true)-->  mock-client.ts  -->  mock-data.ts (SEED)
```

- **`src/integrations/supabase/mock-client.ts`** — cliente Supabase falso. Imita a superfície
  do `@supabase/supabase-js`: `from().select().eq()...`, `auth.getUser()`, `rpc()`, `channel()`,
  `storage`. **Nunca faz rede e nunca lança erro** — toda query resolve `{ data, error: null }`.
- **`src/integrations/supabase/mock-data.ts`** — o usuário fake (`MOCK_USER`) e o `SEED` de
  dados por tabela.
- **`src/integrations/supabase/client.ts`** — quando `VITE_USE_MOCKS=true`, exporta o mock no
  lugar do cliente real. Fora disso, comportamento original intacto (trecho gated, inerte em produção).
- **`.env.mock`** — define a flag e valores dummy. Gitignored (`.env.*`), fica só na sua máquina.

## O que já vem populado

Usuário `Demo Player` (classe Guardião, nível Aprendiz, 640 XP, streak 5) com seed em:
`profiles`, `habits` (+ `habit_logs`), `user_missions`, `daily_quests`, `area_missions`,
`area_progress`, `notifications`, `notification_prefs`, `user_achievements`, `oracle_messages`,
`mental_journal`. As demais tabelas retornam lista vazia (a tela renderiza o estado "vazio",
sem quebrar).

## Como adicionar/editar dados

Abra `mock-data.ts` e edite o objeto `SEED`. A chave é o **nome da tabela**; o valor é um
array de linhas no formato da tabela (veja `integrations/supabase/types.ts`). Exemplo:

```ts
SEED.posts = [
  { id: "p1", user_id: MOCK_USER_ID, body: "Primeiro post!", created_at: new Date().toISOString() },
];
```

Salvou → o Vite recarrega e a tela passa a mostrar o dado. RPCs ficam em `RPC_RESULTS`.

## Limitações conhecidas

- **IA / chat** (`/api/chat`, `/api/ia-capture`, `/api/*-chat`) chamam endpoints de servidor
  que usam o Lovable AI Gateway — **não funcionam offline**. As páginas abrem, mas a geração
  de resposta não responde sem as chaves reais.
- **Push, Stripe e webhooks** também dependem de serviços externos e ficam inertes no mock.
- Os filtros de query (`.eq`, `.order`, `.limit`>1) são **ignorados** (exceto `.limit`, que corta):
  o mock devolve o seed da tabela como está. Suficiente para popular a UI.

## Importante para o fluxo Git ↔ Lovable

- Os arquivos de mock (`mock-client.ts`, `mock-data.ts`, edição em `client.ts`, scripts
  `dev:mock`/`build:mock`) vivem na `develop`. São **inertes** sem `VITE_USE_MOCKS=true`.
- Se um dia isso for para a `main` (e sincronizar com o Lovable), continua inofensivo em
  produção — mas o ideal é **não** levar o mock para a `main`. Mantenha-o em `develop`/`test`.
