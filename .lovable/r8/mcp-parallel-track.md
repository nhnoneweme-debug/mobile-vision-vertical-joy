# Trilha paralela — Integração MCP (identidade técnica provisória "Weme")

Classificação formal: `parallel_unreconciled`.

Esta integração foi construída **fora** da sequência de camadas WIMI-3.7-R8,
após o bloqueio de P0.2-R5. Ela **não** é imputável a P0.3, que permanece
`not_started`. Ela **não** aprova, avança nem substitui nenhuma camada R8.

## Nomenclatura

- Nome canônico do produto: **WIMI**.
- "Vertical Vision": alias legado do projeto.
- "Weme": identidade técnica provisória, presente hoje em
  `src/lib/mcp/index.ts` (`title: "Weme"`), nas descrições de ferramentas e em
  `.lovable/mcp/manifest.json`. A renomeação para WIMI está **pendente de
  deliberação** e não foi executada.

## Plano original da integração (preservado literalmente)

> Conteúdo que ocupava `.lovable/plan.md` antes da rodada de reconciliação.

---

## Resposta direta às duas frentes

**1. Desenvolvimento do app (ChatGPT → Lovable).** Não é possível hoje. Não existe canal em que o ChatGPT envie comandos de build para o agente Lovable e receba os retornos: o Lovable só recebe instruções por este chat. O caminho real é o inverso — o ChatGPT pode acessar contexto (GitHub, docs), gerar o prompt, e você cola aqui. Nada a implementar.

**2. Operação do app (ChatGPT → Weme).** Já existe e é isso que este plano executa. O app publica um servidor MCP em `/mcp` protegido por OAuth do próprio login do Weme, hoje com 5 ferramentas apenas de leitura. Vamos adicionar as ferramentas de escrita que você escolheu.

## O que será construído

Novas ferramentas MCP em `src/lib/mcp/tools/`, todas autenticadas pelo token do usuário (RLS aplica como ele; ninguém enxerga dados de outra conta):

| Ferramenta | Função |
| --- | --- |
| `create_habit` | Cria hábito em `habits` (título, meta semanal, área). |
| `create_mission` | Cria compromisso em `user_missions` (título, área, horário, dias da semana ou pontual). |
| `complete_mission` | Marca missão concluída hoje em `user_mission_logs` (dispara XP pelos triggers existentes). |
| `log_habit` | Registra check-in de hábito em `habit_logs`. |
| `plan_day` | Cria em lote os blocos do dia como missões `one_off`, reaproveitando a lógica já usada em `/planejar`. |
| `undo_completion` | Desfaz um check-in feito por engano. |

Cada ferramenta que altera dados fica marcada com `readOnlyHint: false` — o ChatGPT pede sua confirmação antes de executar. Nenhuma toca chave de serviço; todas usam o helper `supabaseForUser` já existente.

Depois disso, regeneramos o manifesto MCP e validamos.

## Como você conecta (depois do deploy)

1. ChatGPT → Settings → Connectors → Add custom connector.
2. URL: `https://www.wimi.digital/mcp`.
3. O ChatGPT abre a tela de consentimento do Weme; você faz login e aprova.
4. As ferramentas aparecem na conversa — "quais são minhas missões de hoje?", "cria o hábito de beber 2L de água", "marca o treino como feito".

Funciona igual no Claude e no Cursor, mesma URL.

## Detalhes técnicos

- Sem migration: todas as tabelas (`habits`, `habit_logs`, `user_missions`, `user_mission_logs`) já existem com RLS por `auth.uid()`.
- Schemas Zod enxutos (sem enums longos), datas em ISO, `area_slug` validado contra as áreas existentes.
- Cada ferramenta retorna `structuredContent` além do texto, para o ChatGPT encadear chamadas.
- Registro em `src/lib/mcp/index.ts`; manifesto regenerado ao final para conferir que a extração não quebra.
- Nenhuma tela do app é alterada.

---

## Superfície atual implementada (a preservar)

- 11 ferramentas registradas em `src/lib/mcp/index.ts`.
- Autenticação OAuth 2.1 com issuer derivado de `VITE_SUPABASE_PROJECT_ID`
  (`https://<ref>.supabase.co/auth/v1`), audiência `authenticated`.
- Helper `supabaseForUser` em `src/lib/mcp/tools/_shared.ts`: usa
  `SUPABASE_PUBLISHABLE_KEY` + token do usuário. **Nenhuma** referência a
  service role.
- Rota de consentimento `src/routes/[.]lovable.oauth.consent.tsx`.
- Rotas geradas pelo plugin (`src/routes/mcp.ts`, `[.mcp]/*`,
  `[.well-known]/oauth-protected-resource.ts`) — não editar à mão.

## Classificação das ferramentas (verificada)

Somente leitura — **4**:
`get_profile`, `list_missions`, `list_habits`, `list_notifications`.

Mutativas — **7**:
`generate_nudges` (grava em `notifications`), `create_habit`, `log_habit`,
`create_mission`, `complete_mission`, `undo_completion`, `plan_day`.

Correção de premissa: `generate_nudges` foi originalmente descrita entre as
ferramentas "de leitura". Ela **escreve** notificações e é mutativa.

## Riscos abertos (evidência literal, não reparados nesta rodada)

| # | Risco | Evidência | Status |
|---|---|---|---|
| 1 | Rollback de XP divergente | `habit_logs` tem `habit_logs_remove_xp AFTER DELETE → remove_habit_xp()`; `user_mission_logs` tem apenas `trg_user_mission_log_xp AFTER INSERT → award_user_mission_xp()`, sem trigger de DELETE | aberto |
| 2 | Integridade `user_id`/`mission_id` | `user_mission_logs` tem FK só em `mission_id`; sem FK de `user_id` e sem check de que a missão pertence ao mesmo usuário | aberto |
| 3 | `plan_day` não atômico | `plan-day.ts:62-69` faz `update(active:false)` sem capturar `error` e sem transação antes do `insert` | aberto |
| 4 | Contratos código × banco | `title` `slice(0,160)` vs check `≤140`; `remind_before_min` sem teto vs check `0..240`; `notes` sem corte vs check `≤2000`; `end_time <= scheduled_time` aceito; `area_slug` não validado; dias inválidos viram `127` (todos os dias) | aberto |
| 5 | `readOnlyHint: false` | Dica declarativa do protocolo MCP; confirmação humana depende do cliente. Não é controle de segurança | aberto |
| 6 | Classificação das ferramentas | 4 leitura / 7 mutativas (confirmado acima) | resolvido |

Os reparos correspondentes estão na etapa **D** do plano de reconciliação e
dependem do gate humano **G2**. A conexão de ferramentas mutativas a clientes
MCP externos depende de **G3**; publicação depende de **G4**.
