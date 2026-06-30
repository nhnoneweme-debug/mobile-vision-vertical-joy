# Plano de Consolidação — Ciclo de Ajustes Pós-Teste

Agrupei os apontamentos seus e do colega em **6 fases**, da mais crítica (bugs que travam o uso) à mais estratégica (monetização). Cada fase é executável de forma independente; podemos parar entre uma e outra para validar.

---

## Fase 1 — Desbloqueio do Fluxo de Entrada (crítico)

Bugs que impedem o usuário de simplesmente entrar e usar.

- **Erro ao salvar onboarding** ("Entrar no mundo"): diagnosticar via console/replay (provável RLS em `profiles` ou campo novo sem default) e corrigir.
- **Loop de onboarding**: na URL raiz, sessões antigas em `localStorage` mandam direto pro onboarding mesmo quando o perfil já está completo. Acertar o gate em `_authenticated/route.tsx` para redirecionar perfil completo → `/mapa`, e revalidar a sessão sempre que `/` for aberta.
- **Sem volta para a landing**: adicionar botão "Voltar para início" no header do `/onboarding` e no header do `/auth` (mode=signup). Sair de qualquer um leva para `/`.
- **PWA install bar sobrepondo CTA**: mover o `PWAStatus` para uma faixa fixa no topo (ou bottom-sheet recolhível) com `safe-area` próprio, fora da área dos botões principais.
- **Persistência confirmada**: auditar se `profiles.onboarding_completed` está realmente sendo gravado (ver bug acima); documentar que toda decisão de "primeira vez" lê do banco, nunca do `localStorage`.

Entregável: qualquer pessoa abre a URL, escolhe entrar ou criar conta, completa o onboarding sem erro e volta na próxima sessão direto pro mapa.

---

## Fase 2 — Guia Dinâmico ("Mentor") + Renomear "Lore"

Tornar o sistema autoexplicativo sem manual.

- **Renomear "Lore"** para **"Saga"** (ou "Crônica" / "Capítulos" — confirmo com você antes de aplicar). Atualizar tabela `lore_chapters` via view/alias e todas as labels da UI.
- **Mentor flutuante**: bolha persistente em todas as telas (canto, acima do BottomNav) que abre um drawer com:
  - explicação contextual da tela atual (texto curto + 1 dica acionável),
  - chat com a IA já com contexto da rota e do estado do usuário,
  - botão "me mostre" que dispara um tour highlight nos elementos chave.
- **Onboarding-tour pós-cadastro**: 4 passos rápidos sobre Mapa, IA central, Missões e Upper Menu — pulável, mas oferecido uma vez.

---

## Fase 3 — IA-Coletora confiável + Jornada do Dia

A IA precisa **salvar de fato** o que o usuário fala.

- **Bug do "confirme 3 vezes"**: revisar o loop de `applyAuditWrite` / status `pending`. Hoje a IA propõe → grava em `ai_audit_log` → espera confirmação. Vamos:
  - permitir modo **auto-aplicar** (default ON) para ações de baixo risco (criar hábito, log de hábito, ritual upsert, captura de insight),
  - manter confirmação só para `profile.update` e `goal.create`,
  - mostrar toast "salvo por mim" com link de auditoria/undo.
- **Dormir / Despertar não interagindo**: validar que `/api/sleep-chat` e `/api/wake-chat` estão recebendo bearer e respondendo stream; corrigir caso esteja caindo em 401/timeout.
- **Jornada do Dia interativa**: usar `day_blocks` existente para montar blocos (refeição, treino, foco, ritual) que a IA preenche a partir do dump OU o usuário digita. Cada bloco tem check, ganha XP, e aparece na rota `/jornada`.
- **Quests novas via Centro de Missões**: botão "+ Missão" funcional, criando em `daily_quests` ou `scheduled_quests`. Mais dois templates fixos no fim do dia: **"Planejar amanhã"** e **"Diário pós-quest"**.

---

## Fase 4 — Áreas Aprofundadas (Casa, Jardim, Cozinha, Treino, Inclusão)

Cada área ganha o conteúdo específico que faltou.

- **Casa**: campo "Intenção da Semana" (frase livre) salva em `area_progress.meta` ou nova coluna.
- **Jardim Mental**: bloco diário de **3 gratidões** + **1 crença limitante**; questionário guiado (8–10 perguntas) que classifica a crença dominante e gera missão de reframing.
- **Cozinha**: campo "cole sua dieta" (texto livre) → IA parseia em refeições com horários → lembretes push + check por refeição (XP por check).
- **Treino**: editor de treinos (exercícios, séries, reps, carga, tempo); IA monta treino inicial a partir de objetivo/limitações; histórico de progressão de carga.
- **Trilha de Inclusão**: nova `level_track` "Adaptado" com perguntas extras sobre limitações; IA gera treinos/missões respeitando restrições.
- **Erro nos botões "+"** das áreas (cozinha/quarto/jardim) e do **Orientador**: rastrear e corrigir (provável handler quebrado ou política RLS faltando).

---

## Fase 5 — Social, Grupos e Comunidade

Transformar `/social` em praça viva.

- **Bug ao publicar**: investigar o `PostComposer` (upload pro bucket `social-media` + insert em `posts`); corrigir.
- **Adicionar amigos** por código, email, telefone e link de convite WhatsApp (já parcialmente feito; finalizar fluxo email/telefone).
- **Grupos/Comunidades** (`groups` + `group_members` já existem): UI para criar grupo, convidar, ver feed do grupo, chat interno simples (tabela nova `group_messages` com realtime).
- **Encontros para treino**: tipo de post "evento" com data/local; RSVP.
- **Desafios com postagens**: permitir post atrelado a um `studio_challenge` (já temos `challenge_progress`); feed filtrado por desafio.
- **Orientador — código visível**: na tela Painel-Orientador, mostrar o `orientador_invites.code` do orientador logado com botão copiar/compartilhar.

---

## Fase 6 — Calendário, XP semanal e Monetização

- **Liberação semanal**: bloquear botão "avançar semana" no `/calendario` até a data real chegar; XP futuro aparece como "selado".
- **XP fixo no calendário**: cada evento agendado tem XP pré-definido visível.
- **Monetização**: definir modelo (assinatura mensal Brasas+, pacotes de Brasas, desbloqueio de Cristais premium, marketplace de planos de orientadores). Implementar via Stripe (vou recomendar provider). Esta fase exige decisão sua antes de codar.

---

## Detalhes técnicos (referência)

- Fase 1 toca: `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/onboarding.tsx`, `src/components/onboarding/OnboardingShell.tsx`, `src/components/pwa/PWAStatus.tsx`, possível migração em `profiles`.
- Fase 2: novo `MentorBubble.tsx` global no `__root.tsx`, integra com `/api/chat` passando rota atual; renomeação de labels em `src/lib/lore.ts` e rotas relacionadas.
- Fase 3: ajustar `src/lib/ia-capture.functions.ts` (auto-apply whitelist), revisar `src/routes/api/sleep-chat.ts` e `wake-chat.ts`, novo CRUD em `day_blocks`, botão "+" funcional em `/painel` e `/jornada`.
- Fase 4: migrações para campos novos (intenção semana, gratidões, dieta parseada, treinos), parser de dieta via Lovable AI.
- Fase 5: nova tabela `group_messages` com RLS por membership, realtime; correção do upload no bucket `social-media`.
- Fase 6: lógica de "semana atual" no calendário; integração Stripe via `stripe--enable_stripe`.

---

## Ordem sugerida de execução

1. **Fase 1 agora** (1 ciclo) — destrava todo mundo.
2. **Fase 3** (IA confiável) em seguida — é o coração da proposta.
3. **Fase 2** (Mentor + renome) — eleva percepção de produto.
4. **Fase 4** áreas — em sub-etapas (Casa+Jardim → Cozinha → Treino → Inclusão).
5. **Fase 5** social — depois que o core estiver sólido.
6. **Fase 6** monetização — só quando o engajamento estiver fluindo.

Confirma se faz sentido, ou quer reordenar? Duas decisões que preciso de você antes da Fase 2:
- **Substituto de "Lore"**: prefere "Saga", "Crônica" ou outro?
- **Monetização (Fase 6)**: já miramos Stripe (assinatura + pacote de Brasas) ou quer explorar antes?
