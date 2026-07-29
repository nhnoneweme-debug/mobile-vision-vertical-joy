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
