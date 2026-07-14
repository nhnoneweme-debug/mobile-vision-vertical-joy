# Círculo → Desafios estilo GymRats

Reutiliza `groups`, `group_members`, `group_posts`, `challenges`, `challenge_progress`, `workout_sessions` e `group_weekly_ranking`. Nada é duplicado.

## 1. Migration `challenge_checkins` + regras

Tabela nova:

```sql
CREATE TABLE public.challenge_checkins (
  id uuid PK,
  challenge_id uuid → challenges(id) ON DELETE CASCADE,
  user_id uuid → auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  workout_session_id uuid → workout_sessions(id) ON DELETE SET NULL,
  note text, photo_url text,
  points int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id, checkin_date)
);
```

GRANT + RLS:
- SELECT: membros do grupo do desafio (`is_group_member(challenges.group_id, auth.uid())`).
- INSERT/DELETE: `user_id = auth.uid()` **e** membro do grupo do desafio.
- UPDATE: bloqueado (imutabilidade / anti-cheat).

Trigger `validate_challenge_checkin` (BEFORE INSERT):
- Busca `starts_at`, `ends_at`, `group_id` do desafio.
- Verifica `checkin_date BETWEEN starts_at::date AND ends_at::date`.
- Verifica que o usuário é membro do grupo.
- Se `workout_session_id` informado, valida ownership.

Trigger `recalc_challenge_progress` (AFTER INSERT/DELETE em `challenge_checkins`):
- Lê `metric` do `challenges`:
  - `checkins`: `COUNT(*)` de check-ins do usuário no desafio.
  - `treinos`: `COUNT(*)` onde `workout_session_id IS NOT NULL`.
  - `minutos`: `SUM(ws.duration_sec)/60` das sessões vinculadas.
- Faz `UPSERT` em `challenge_progress (challenge_id, user_id, value)`.

Trigger `auto_group_post_on_checkin` (AFTER INSERT):
- Conta o n-ésimo dia do usuário no desafio.
- Insere em `group_posts` (`group_id` do desafio, autor = user) mensagem "{nome} treinou hoje 💪 — {n}º dia" + `photo_url` se houver. Falha silenciosa.

Função RPC:
- `challenge_leaderboard(_challenge uuid)`: retorna user_id, display_name, avatar_url, value, position — só para membros.
- `challenge_calendar(_challenge uuid, _month date)`: retorna user_id, checkin_date para membros (bolinhas do calendário).
- `finalize_challenge(_challenge uuid)`: se `ends_at < now()` e não finalizado, marca vencedor (top do progress), grava `xp_events` (+100 XP para o vencedor, +25 para participantes) e conquista via `check_achievements`. Idempotente via coluna `winner_user_id` a adicionar em `challenges`.

Nova coluna: `challenges.winner_user_id uuid` + `finalized_at timestamptz`.

## 2. Storage

Bucket privado `challenge-photos`. RLS em `storage.objects`:
- SELECT: membros do grupo do desafio (path `<challenge_id>/<user_id>/<file>`).
- INSERT/DELETE: dono (`user_id = auth.uid()` derivado do path).

## 3. Auto-check-in ao concluir treino

`src/lib/circles.ts` (existente) + novo `src/lib/challenges.ts`:
- `getActiveChallengesForUser()`: challenges ativos dos grupos do usuário sem check-in hoje.
- `checkinToChallenge({ challengeId, workoutSessionId?, note?, photoFile? })`: upload da foto → insert em `challenge_checkins` (unique cobre dedupe).
- Hook em `src/lib/treino.functions.ts` / lugar que insere `workout_sessions`: após insert, retornar os desafios elegíveis; UI decide oferecer.

Componente `PostWorkoutCheckinSheet` aparece após concluir treino, listando desafios elegíveis com toggle e um "Confirmar check-ins".

## 4. UI `/circulo`

Rota `src/routes/_authenticated/circulo.tsx` reformulada com Tabs:

- **Feed**: `group_posts` dos grupos do usuário (já existe pipeline em `src/lib/circles.ts`). Card destacado quando é auto-post de check-in.
- **Desafios**: seções colapsáveis Ativos / Próximos / Encerrados. Cada card mostra grupo, título, métrica, dias restantes, seu progresso, top 3. Botão "Criar desafio" abre `ChallengeForm` (Sheet).
- **Ranking**: seletor de grupo + `group_weekly_ranking` existente.

Detalhe do desafio (`/circulo/desafio/$id` → `src/routes/_authenticated/circulo.desafio.$id.tsx`):
- Header com título/métrica/prazo.
- Ranking ao vivo (`challenge_leaderboard`).
- Calendário mensal com bolinhas coloridas por membro (`challenge_calendar`).
- Botão "Check-in de hoje" (desabilitado se já feito). Sheet com nota, foto opcional, vincular treino de hoje se existir.
- Se encerrado: banner "Vencedor: X 🏆".

Todos os fetches com skeletons e empty states (nenhum grupo / nenhum desafio / desafio sem check-ins ainda).

## 5. Cron opcional

`pg_cron` diário 00:05 chamando `finalize_challenges_all()` (loop de `finalize_challenge` para todos vencidos e não finalizados). Fora do escopo mínimo, mas incluído se sobrar espaço; senão finalize dispara sob demanda no detalhe.

## Arquivos

Novos:
- migration `challenge_checkins` + triggers + rpcs + colunas em challenges.
- `src/lib/challenges.ts` (client).
- `src/components/circulo/ChallengeCard.tsx`
- `src/components/circulo/ChallengeForm.tsx`
- `src/components/circulo/ChallengeCheckinSheet.tsx`
- `src/components/circulo/ChallengeCalendar.tsx`
- `src/components/circulo/ChallengeLeaderboard.tsx`
- `src/components/circulo/PostWorkoutCheckinSheet.tsx`
- `src/routes/_authenticated/circulo.desafio.$id.tsx`

Editados:
- `src/routes/_authenticated/circulo.tsx` (3 abas)
- ponto onde `workout_sessions` é inserido (dispara sheet de check-in)
- storage bucket via tool

## Escopo fora
- Comentários/reações no post automático (usa infra existente do feed).
- Notificações push do check-in — próximo passo.

Confirma para eu executar?