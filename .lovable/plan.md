# Fase 4 — Expansão completa (4 etapas sequenciais)

Você pediu todas. Entrego uma de cada vez, validando antes de avançar. Estimativa: 4 turnos.

## Etapa 4.1 — Personal IA Score + relatórios *(começo agora)*
A base. Consolida tudo que já existe (XP, áreas, hábitos, streak) num **score único** de 0-1000 + relatório semanal.

- View SQL `personal_ia_score` (peso: 30% XP global, 25% áreas, 25% hábitos consistentes, 20% streak).
- Tabela `score_snapshots` (user_id, week_start, score, breakdown jsonb) + cron semanal (domingo 23h) que grava snapshot.
- Rota `_authenticated/progresso.tsx`: anel grande com score atual, delta da semana, breakdown por dimensão (4 barras), sparkline 8 semanas, lista de áreas mais fortes/fracas.
- Atualização do tile "Templo do Progresso" no mapa pra mostrar score.

## Etapa 4.2 — Notificações + ritual diário
Push browser + ritual de 3 toques (manhã + noite).

- Tabela `notification_prefs` (user_id, morning_hour, night_hour, push_enabled, push_subscription jsonb).
- Service worker + Web Push API (VAPID keys via secret).
- Server route `/api/public/hooks/morning-ritual` e `/api/public/hooks/night-review`, agendados via pg_cron por hora (escolhe usuários cujo prefs.morning_hour = hora atual).
- Rota `_authenticated/ritual.tsx` com 3 cards (Quest do dia, Hábito chave, Intenção) de manhã e revisão noturna (3 reflexões + IA fecha o dia).
- Toggle em `/perfil` pra ativar push e escolher horários.

## Etapa 4.3 — Social: amigos, grupos e desafios
- Tabelas `friendships` (a, b, status), `groups` (name, owner, code), `group_members`, `challenges` (group_id, title, metric, target, ends_at), `challenge_progress`.
- Rota `_authenticated/social.tsx` com 3 abas: Amigos | Grupos | Desafios. Adicionar amigo via código curto (`@aluno-xxxx`).
- Ranking semanal por XP/streak dentro do grupo.
- Notificação quando amigo te ultrapassa ou completa desafio.
- Entry no `BottomNav`.

## Etapa 4.4 — Modo Orientador (personal trainer)
- Enum `app_role` (`player`, `orientador`, `admin`) + tabela `user_roles` + função `has_role` (padrão seguro, security definer).
- Tabela `orientador_students` (orientador_id, student_id, status, invited_at).
- Tabela `orientador_missions` (orientador_id, student_id, title, area_slug, xp_reward, due_at). Aparece como missão extra no mapa do aluno.
- Rota `_authenticated/painel.tsx` (visível só pra role=orientador): lista de alunos com score, último check-in, alerta de inatividade (>3 dias sem quest), botão "enviar missão" e chat 1:1.
- Upgrade de role via código de convite no perfil (sem privilégio escalável pelo cliente — validação por RPC).

## Aceite por etapa
Cada etapa termina com: migration aprovada → UI funcional em 390px → loop testado fim a fim no preview.

**Começo pela 4.1 (Score + relatórios) assim que aprovar.**
