# Plano completo — execução em 5 fases

Vou entregar **uma fase por turno**, do menor risco para o maior. Cada fase termina utilizável.

---

## Fase A — Bugs críticos (1 turno)

Resolver o que está quebrado **antes** de mexer em estrutura.

- **Ritual manhã/noite salvando erro**: tabela `ritual_logs` tem unique `(user_id, ritual_date, ritual_type)`. Trocar `insert` por `upsert` em `src/lib/ritual.ts` e tratar reentrada. Confirmar que trigger `award_ritual_xp` não duplica XP em update.
- **Botão `+` quebrado em Centro de Missões, Cozinha, Quarto e Jardim Mental**: investigar `area.$slug.tsx` / `AreaMissionRow` — provavelmente o handler de "nova missão personalizada" não existe ou navega para rota inexistente. Implementar sheet local de criação ligado a `area_missions`/`area_mission_logs`.
- Validar com Playwright em cada uma das 4 áreas.

---

## Fase B — Nova navegação + identidade de tela (1 turno)

Redesign do `BottomNav` + label discreto de área.

```text
[ MAPA ] [ HÁBITOS ] [ IA✦ ] [ PLANO ] [ MAIS ▴ ]
                       ↑ destaque centro
```

- **5 slots fixos**: Mapa · Hábitos · **IA (centro, destaque ember-glow)** · Plano · Mais.
- **Highlight ativo**: barra superior ember + bg sutil + indicador inferior na aba atual.
- **Botão "MAIS"** (canto inferior direito): abre bottom sheet com **TODAS as áreas do sistema** organizadas:
  - 1ª linha: **Perfil**, Loja, Conquistas
  - 2ª linha: Progresso, Calendário, Rituais, Social
  - 3ª linha: Classe, Painel Orientador, áreas (Treino, Cozinha, Quarto, Mental, Social)
  - Item correspondente à tela atual ganha marcação "VOCÊ ESTÁ AQUI".
- **Label discreto de área**: criar `<AreaLabel>` que aparece fixo no topo de cada tela (`text-[10px] tracking-[0.3em]`) — não-intrusivo, sempre orienta.

---

## Fase C — Gênero & Níveis duais (1 turno)

Mesma escala matemática (XP idêntico), nomenclatura diferente.

- Migration: `profiles.level_archetype` (`m1|m2|m3|f1|f2|f3|neutral`).
- 6 trilhas em `src/lib/level-archetypes.ts`:
  - **Masculino**: Guerreiro · Estoico · Estrategista
  - **Feminino**: Sacerdotisa · Amazona · Alquimista
  - Neutro (atual: Aprendiz→Arquiteto) como fallback.
- Seletor no Perfil → "Estilo de jornada".
- Aplicar em HUD, ScoreRing, Skill Tree e títulos.

---

## Fase D — IA-Coletora (núcleo novo, 2 turnos)

Transformar o Orientador num **agente de captura** que substitui formulários.

**D.1 — Backend (1 turno)**
- Tabela `ai_capture_sessions` (id, user_id, transcript, attachments[], status, summary, applied_changes jsonb).
- Tabela `ai_audit_log` (quem/quando/o quê escreveu no banco via IA).
- Server function `ai-capture.functions.ts` (com `requireSupabaseAuth`):
  - Recebe dump de áudio/texto/vídeo.
  - Áudio → transcrição (Gemini multimodal).
  - Carrega schema de tabelas-alvo permitidas: `profiles`, `habits`, `habit_logs`, `daily_quests`, `area_missions`, `ritual_logs`, `strategic_goals`, `scheduled_quests`.
  - LLM com tools tipadas: `propose_writes(table, rows[])`, `ask_user(question)`, `done(summary)`.
  - Aplica writes via `supabase` autenticado (RLS) e registra em `ai_audit_log`.

**D.2 — Frontend (1 turno)**
- Rota IA central (botão do meio da nav) — `/ia`:
  - Chat com botão grande **DUMP** (mic + anexo + texto).
  - Mostra perguntas do agente, propostas de escrita ("Vou registrar: 80kg em peso, 7h de sono ontem. Confirmar?"), confirmação por toque.
  - Histórico de auditoria ("o que a IA fez por mim").
- Em cada formulário do app (perfil, hábitos, missões, rituais): botão flutuante "✦ Falar com IA" que abre o capture com contexto pré-carregado da tela.

---

## Fase E — Praça Social + Cristais do Poder (2 turnos)

**E.1 — Identidade & convites (1 turno)**
- Card de "Meu Código" fixo no topo de `/social` com QR + botão **Compartilhar no WhatsApp** (`wa.me/?text=...`).
- Adicionar amigo por **email** ou **telefone** (lookup em `profiles.phone` / via Auth Admin server fn).
- Validação Zod, rate limit simples.

**E.2 — Feed + Cristais (1 turno)**
- Tabelas: `posts` (text, media_url, media_type), `post_views`, `post_likes`, `post_comments`.
- Storage bucket `social-media` (público para leitura de mídia compartilhada).
- Feed vertical (texto, imagem, vídeo) com upload via drop ou IA-Coletora.
- Lista de atividades de amigos + descoberta (sugestões por classe afim).
- **Cristais do Poder** — sistema de perks desbloqueáveis:
  - `crystal_temporal` (48h após marco) — vê viewers de novas postagens por 48h.
  - `crystal_conditional` (mantém streak ≥ 14d) — vê viewers enquanto condição valer.
  - `crystal_eternal` (conquista épica nível 20) — vê viewers para sempre.
  - UI: ícone de olho ao lado do contador de views nos cards de post; bloqueado mostra cadeado + dica de como desbloquear.

---

## Detalhes técnicos

- **Tabelas novas** (Fases D e E): todas com RLS por `auth.uid()`, GRANT em `authenticated` + `service_role`, triggers `updated_at`.
- **Storage `social-media`**: público leitura, write só do dono via RLS em `storage.objects`.
- **IA**: Gemini 3 Flash (multimodal, suporta áudio/imagem/vídeo) via Lovable AI Gateway.
- **Auditoria**: cada write feito pela IA gera linha em `ai_audit_log` com diff JSON antes/depois.
- **Permissões da IA**: whitelist explícita de tabelas/colunas que ela pode tocar — nunca `user_roles`, `profiles.id`, `xp`, `brasas`, `streak` (esses só por triggers).

---

## Pergunta única antes de começar

**Cristais do Poder** — confirma os 3 tiers (temporal 48h / condicional por streak / eterno por conquista épica) ou prefere outra curva?

Responda **"vai"** para eu começar pela **Fase A (bugs)** agora.