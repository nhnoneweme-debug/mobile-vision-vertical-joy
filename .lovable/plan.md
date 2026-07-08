
## Relatório de validação (somente leitura — nada foi alterado)

### 1) Rotas removidas — referências restantes

Rotas checadas: `alarme`, `despertar`, `sonhos`, `cristais`, `classe`, `painel`, `painel-aluno.$id`, `area.orientador`, `planos`, `api/wake-chat`.

- **Nenhum `<Link to=...>`, `navigate(...)`, `redirect(...)` ou `import` aponta para essas rotas.** Rotas confirmadas ausentes em `src/routes/_authenticated/` e `src/routes/api/`.
- **Único resíduo:** `src/lib/mentor-tips.ts` mantém entradas de dicas para os paths `/painel`, `/classe`, `/despertar`, `/sonhos` (chaves de objeto usadas para tooltips por rota). Não quebra build nem navegação — vira código morto até serem removidas.
- `src/routes/_authenticated/jornada.tsx` menciona a palavra "despertar" só em texto/copy (prompt do gerador de blocos). Não é link.

**Conclusão:** sem imports/links quebrados. Cleanup opcional em `mentor-tips.ts`.

### 2) Migration `20260708000000_security_hardening_frontend_trust.sql`

- Arquivo presente e consistente:
  - Cria trigger `trg_protect_profile_economy` (BEFORE UPDATE em `profiles`) que zera alterações de `xp/brasas/level/streak` vindas de `authenticated`/`anon` (SECURITY DEFINER preserva funções internas).
  - `REVOKE INSERT/UPDATE/DELETE ON public.user_crystals FROM authenticated` + drop da policy `user_crystals_modify_own`.
  - Recria view `public_profiles` (id, display_name, behavioral_class, xp, level) — **atenção: essa lista é MAIS ENXUTA que a `public_profiles` atual em produção** (que hoje inclui friend_code, streak, level_track, etc., conforme migration 20260703). Rodar isso vai **remover colunas** que outras telas podem estar lendo. Verificar consumidores de `public_profiles` antes de aplicar.
  - Drops de policies `Authenticated can read public profile fields` e `Public profile fields readable via view` são no-op (já não existem).

- **Status no banco: NÃO aplicada.**
  - `pg_trigger` não contém `trg_protect_profile_economy`.
  - Policies atuais de `profiles`: só `Users can insert/update/view their own profile` + `orientador reads linked student profiles`.
  - `user_crystals`: só `user_crystals_select_own`, sem grants de escrita para `authenticated` (já revogados — provavelmente estado anterior; o REVOKE do arquivo será no-op).
  - View `public_profiles` existe (da migration anterior, com o schema mais amplo).

### 3) IA — `/api/chat` e `/api/converse`

- Ambos usam `createChatModelWithFallback` de `src/lib/ai-gateway.server.ts`, que **prefere `OPENAI_API_KEY`** (OpenAI direto) e cai para `LOVABLE_API_KEY` (Lovable Gateway) se OpenAI ausente.
- **`OPENAI_API_KEY` NÃO está configurado nos secrets do projeto.** Os secrets presentes incluem `LOVABLE_API_KEY`.
- Consequência: os endpoints **funcionam via Lovable AI Gateway** (modelo `openai/gpt-5.5` + fallback `openai/gpt-5-mini`), não via OpenAI direto. Sem quebra.
- Guardas de auth OK (`Bearer` + `supabase.auth.getClaims`). `converse` também tem modo dev:mock condicional a `VITE_USE_MOCKS`.

### 4) Fluxos com Supabase/RLS

RLS conferido em `pg_policies`:

- **login**: gerenciado por `_authenticated/route.tsx` (client-only, `supabase.auth.getUser`) + gate de onboarding. OK.
- **habits (criar)**: `INSERT with_check (auth.uid() = user_id)` ✅ + SELECT/UPDATE/DELETE próprios ✅.
- **user_missions (criar compromisso)**: `INSERT with_check (auth.uid() = user_id)` ✅ + SELECT/UPDATE/DELETE próprios ✅.
- **user_mission_logs (marcar feito)**: `INSERT with_check (auth.uid() = user_id)` ✅ + SELECT/UPDATE/DELETE próprios ✅. Trigger `award_user_mission_xp` continua rodando (SECURITY DEFINER, não afetado por RLS).

**Nenhum fluxo listado quebra.** Observação: se a migration §2 for aplicada como está, updates de `profiles` (ex.: preferências de perfil que também tocam colunas de economia num mesmo payload por engano) terão os campos de economia silenciosamente ignorados — comportamento esperado, mas vale auditar chamadas de `profiles.update({...})` no cliente antes de aplicar.

### Ações sugeridas (fora deste turno)
- Remover entradas de rotas mortas em `src/lib/mentor-tips.ts`.
- Antes de aplicar a migration 20260708: alinhar a lista de colunas da view `public_profiles` com o que a UI já consome (ver migration 20260703).
- Se quiser OpenAI direto, adicionar `OPENAI_API_KEY` em Project Settings → Secrets; caso contrário, Lovable Gateway já cobre.
