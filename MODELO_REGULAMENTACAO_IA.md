# Modelo de Regulamentação da Inteligência (Personal IA)

Versão 1.0 — 2026-07-08 · Aplica-se ao Orientador (chat) e ao pipeline de captura
(`/api/chat`, `/api/ia-capture`, geradores de treino/dieta/rituais).

Este documento define **o que a IA pode acessar e fazer**, com quais salvaguardas.
É a fronteira de confiança da inteligência: ela **propõe e executa sob permissão**,
nunca age sozinha sobre dados sensíveis.

---

## 1. Princípios

1. **Privacidade primeiro / dado mínimo.** A IA só consulta os dados necessários
   para a tarefa em questão, e **apenas do próprio usuário**.
2. **Consentimento explícito para escrever.** Nada é criado ou modificado sem uma
   **proposta** revisável e uma **confirmação** do usuário.
3. **Não-invasiva.** Age só quando solicitada. Não envia mensagens não pedidas,
   não insiste, não assume. Propõe — não impõe.
4. **Transparente e reversível.** Toda escrita fica registrada e pode ser desfeita.
5. **Fundamentada nos dados.** As sugestões (treino, dieta, hábitos, tarefas)
   derivam do contexto real do usuário; a decisão final de aplicar é do usuário.
6. **Segura por padrão.** Sem diagnóstico médico, sem prescrição perigosa, sem
   incentivo a comportamento nocivo (dieta extrema, overtraining, etc.).

---

## 2. Provedor e segredos

- A inteligência usa a **API da OpenAI** (`OPENAI_API_KEY`) quando disponível;
  senão, o Lovable AI Gateway. Configurado em `src/lib/ai-gateway.server.ts`.
- **A chave vive apenas no ambiente do servidor** (`OPENAI_API_KEY`). Nunca no
  código, no bundle do cliente, nem no repositório. As chamadas de IA rodam em
  rotas/edge server-side; o navegador nunca vê a chave.
- Variáveis de ambiente relevantes: `OPENAI_API_KEY`, `AI_CHAT_MODEL`
  (default `gpt-4o`), `AI_FALLBACK_MODEL` (default `gpt-4o-mini`), `HOOKS_SECRET`.

---

## 3. Isolamento de dados (quem a IA enxerga)

- Todo acesso a dados do usuário passa pelo **JWT do próprio usuário** e pela
  **RLS** do Supabase. A IA **nunca** usa o service role para ler/gravar dados de
  usuário — logo, só consegue enxergar e alterar dados de quem está logado.
- Dados de terceiros **não** são acessíveis pela IA (RLS de "própria linha").
- Preferências de **inclusão** (`inclusion.pronouns`, `ia_tone`, `no_go_topics`,
  `language_level`) são carregadas no contexto e **devem ser respeitadas sempre**.

---

## 4. Escopos de LEITURA (consulta de contexto)

A IA pode consultar, **somente do usuário atual**:

| Domínio            | Fonte                         | Uso |
|--------------------|-------------------------------|-----|
| Perfil             | `profiles` (própria linha)    | nome, classe, objetivo, nível, medidas |
| Hábitos            | `habits`                      | metas e frequência |
| Missões/tarefas    | `user_missions` + logs        | agenda e conclusão do dia |
| Progresso de áreas | `area_progress`               | níveis/XP por área |
| Treino             | `area_progress.meta.training_plan` | plano atual |
| Dieta              | `area_progress.meta.diet_plan`     | plano atual |
| Sono               | `sleep_logs`                  | qualidade recente |
| Mental             | `mental_journal`              | crenças/reframes recentes |
| Histórico do chat  | `oracle_messages`             | continuidade da conversa |

Não é permitido: ler dados de outros usuários, tabelas administrativas
(`user_roles`, `studio_*`), segredos, ou PII além do necessário.

---

## 5. Escopos de ESCRITA (criar / modificar)

Toda escrita segue o fluxo **Proposta → Confirmação → Execução → Auditoria**:

| Capacidade            | Escreve em                    | Requer confirmação | Auditado/Reversível |
|-----------------------|-------------------------------|--------------------|---------------------|
| Criar hábito          | `habits` (via RPC/serverfn)   | **Sim**            | Sim                 |
| Criar compromisso/missão | `user_missions`            | **Sim**            | Sim                 |
| Concluir/editar tarefa   | `user_mission_logs`        | **Sim**            | Sim                 |
| Propor/gerar treino   | `area_progress.meta.training_plan` | **Sim**       | Sim                 |
| Propor/gerar dieta    | `area_progress.meta.diet_plan`     | **Sim**       | Sim                 |
| Rituais/quarto        | `quarto` rituals              | **Sim**            | Sim                 |

Regras:

- A IA **nunca** grava direto sem passar pela proposta confirmada pelo usuário.
- A execução usa as **server functions autenticadas** (`.middleware([requireSupabaseAuth])`)
  e/ou o pipeline `ia-capture` com **trilha de auditoria** (`ai_capture_sessions`,
  `ai_audit_log`) e ações `applyAuditWrite` / `rejectAuditWrite` / `undoAuditWrite`.
- Colunas de economia (`xp`, `brasas`, `level`, `streak`, cristais) **não** são
  graváveis por este caminho — só por RPCs de jogo (ver `SECURITY_REVIEW.md`, F2).

---

## 6. Guardrails de conteúdo e bem-estar

- **Sem diagnóstico ou prescrição médica.** Pode orientar hábitos saudáveis e
  sugerir procurar um profissional quando fizer sentido.
- **Não incentivar risco:** dietas de restrição severa, jejum extremo,
  overtraining, metas irreais de peso — a IA recua e sugere abordagem saudável.
- **Respeita `no_go_topics`** e o tom/linguagem definidos em inclusão.
- **Temas sensíveis** (sofrimento emocional, autolesão): acolhe, não reforça, e
  aponta apoio adequado; nunca fornece meios de dano.
- Não expõe dados sensíveis sem necessidade nem os repete de volta gratuitamente.

---

## 7. Não-invasividade (limites de iniciativa)

- A IA **responde a pedidos**; não inicia contato nem cria nada por conta própria.
- Ao faltar dado, **pergunta** em vez de inventar.
- Sugestões vêm com o **porquê** (baseado em quais dados), e sempre com opção de
  recusar/ajustar. O usuário decide.

---

## 8. Auditoria, rate limit e custo

- Escritas ficam registradas (`ai_audit_log`) e podem ser desfeitas.
- Rate limits por workspace no gateway; erros 402/429 acionam o **modelo de
  fallback** automaticamente (`AI_FALLBACK_MODEL`).
- Custo é usage-based (OpenAI) — monitorar o consumo da chave.

---

## 9. Estado atual x roadmap

**Já existe:** leitura de contexto rica no `/api/chat`; criação com auditoria no
`/api/ia-capture`; geradores de treino/dieta/rituais; provider OpenAI; fallback.

**Para o agente conversacional completo** (conversar + propor + criar numa só
tela), falta ligar as *tools* de leitura/escrita ao chat `/conversar` com o fluxo
de confirmação. Recomenda-se implementar como *tool calling* (AI SDK) apontando
para as server functions autenticadas — mantendo este modelo de regulamentação.
