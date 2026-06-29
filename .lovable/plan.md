# Fase E — Rede Social + Cristais + Studio

## Visão geral
Três frentes integradas: feed social com privacidade granular, sistema de Cristais do Poder com efeitos em camadas (Olho do Oráculo + Eco do Mentor no MVP) e um Studio de gestão para admins criarem desafios e prêmios dinâmicos sem código.

---

## E.1 — Rede Social interna

### Banco
- `posts` (id, author_id, body text, media_url, media_type [image|video|none], visibility_mode [auto|manual|hybrid], visibility_rule jsonb, created_at)
- `post_audience` (post_id, audience_type [friend|guild|class|user], audience_id) — alimenta o "manual" e o "hybrid"
- `post_reactions` (post_id, user_id, kind [ember|insight|strength])
- `post_comments` (post_id, user_id, body, created_at)
- `post_views` (post_id, viewer_id, viewed_at) — base do Olho do Oráculo
- `follows` (follower_id, followed_id) — assimétrico, separado de friendships
- Storage bucket `social-media` (público com RLS de write por owner)

### Visibilidade granular
Cada post escolhe um modo:
- **auto**: regra salva no perfil (ex. "sempre amigos+guilda")
- **manual**: usuário marca audiências específicas no composer
- **hybrid**: regra automática + exceções manuais (incluir/excluir)
Função SQL `can_view_post(viewer, post)` consulta `post_audience` + regra jsonb e é usada por RLS.

### Frontend
- Rota `/social` reformulada com tabs: **Feed**, **Amigos**, **Descobrir**
- `PostComposer` com upload (imagem/vídeo ≤30s via MediaRecorder/file), seletor de audiência granular
- `PostCard` com reações, comentários, contagem de views (clicável se cristal ativo)
- Topo da aba Amigos: card grande com **meu friend_code**, botão "Compartilhar no WhatsApp" (deep link wa.me) + 3 modos de adicionar amigo (código, email, telefone)

---

## E.2 — Cristais do Poder

### Banco
- `power_crystals` (id, code, name, description, icon, effect_type, effect_config jsonb, rarity)
- `user_crystals` (user_id, crystal_id, mode [temporal|conditional|permanent], acquired_at, expires_at nullable, condition jsonb nullable, active boolean)
- Função `is_crystal_active(user, code)` resolve mode+condição+expiração
- View `active_user_crystals` para consulta rápida no client

### Cristais iniciais
1. **Olho do Oráculo** — revela lista de viewers silenciosos em `post_views`
2. **Eco do Mentor** — multiplica XP de hábitos por 2 enquanto ativo

Cada um pode existir em qualquer um dos 3 modos (drop define qual).

### Frontend
- Nova aba "Cristais" em `/conquistas` com inventário + estado (temporal countdown, condição atual, permanente)
- Badge no HUD do mapa quando há cristal ativo
- Hook `useActiveCrystals()` consultado por features que reagem (PostCard mostra viewers, award_habit_xp lê multiplicador)
- Trigger SQL atualiza `xp_events.amount` se Eco do Mentor ativo no momento do log

---

## E.3 — Studio de Gestão (admin)

Painel para a equipe criar conteúdo dinâmico sem migration.

### Banco
- `studio_rewards` (id, kind [crystal|brasas|xp|inventory_item|badge], payload jsonb, created_by, active)
- `studio_challenges` (id, title, description, cover_url, start_at, end_at, rules jsonb, status [draft|published|archived])
- `studio_challenge_rewards` (challenge_id, reward_id, tier int, criteria jsonb) — múltiplos prêmios por perspectiva
- `studio_challenge_participants` (challenge_id, user_id, progress jsonb, completed_at, awarded_rewards uuid[])
- Role `studio_admin` adicionado em `app_role` enum; gate via `has_role`

### Regras dinâmicas
`rules` jsonb suporta perspectivas combinadas:
```
{ "perspectives": [
  { "name": "execução", "metric": "habit_completion", "target": 30 },
  { "name": "constância", "metric": "streak_min", "target": 14 },
  { "name": "social", "metric": "posts_count", "target": 5 }
]}
```
Engine SQL `evaluate_challenge(user, challenge)` retorna progresso por perspectiva e quais tiers de prêmio foram alcançados.

### Frontend Studio
- Rota `/_authenticated/studio` (gate `studio_admin`)
- **Reward Builder**: form dinâmico que muda campos conforme `kind` (cristal: escolher modo/condição; brasas: amount; item: shop_items)
- **Challenge Builder**: editor visual de perspectivas (adicionar/remover métricas), agendamento, anexar múltiplos prêmios por tier
- **Preview & Publish** com simulação contra um usuário-teste
- Lista de desafios ativos com participantes e métricas

### Para o jogador
- Nova rota `/desafios` lista desafios publicados, com barra de progresso por perspectiva e prêmios visíveis
- Drop automático de cristais/recompensas via `award_challenge_rewards()` quando critério bate

---

## Ordem de implementação
1. Migration única com todas as tabelas + RLS + grants + funções base
2. Storage bucket + policies
3. Server fns: criar post, reagir, comentar, registrar view, listar feed com visibilidade
4. UI rede social (composer, feed, cards, friend card no topo)
5. Cristais: catálogo seed (Olho + Eco), hook, badge HUD, integração com habit XP e viewers
6. Studio: gate de role, builders, engine de avaliação
7. Rota `/desafios` para jogadores

## Detalhes técnicos
- Vídeo: client-side check de duração (≤30s) + tamanho (≤20MB) antes do upload; thumbnail gerada via `<video>` + canvas
- Views: debounce de 2s antes de inserir em `post_views`, único por (post,viewer)
- Cristais temporais: cron diário desativa expirados (`update user_crystals set active=false where expires_at < now()`)
- RLS de `post_views`: viewer pode inserir o próprio; autor lê só se cristal ativo (checado em server fn, não em RLS)
- Studio: todas as escritas via server fns com `has_role(_, 'studio_admin')` check
- Multimodal de mídia segue padrão Storage signed URLs

## Escopo fora
- Notificações push de reações/comentários (Fase F)
- Moderação automática de conteúdo
- Stories/efêmeros
- Mensagens diretas
