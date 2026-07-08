# Plano de Redesign — "Forja"

Plano de redesign das telas, co-criado a partir do esquema do Excalidraw
(`Novo Layout do app.md`) e do sistema visual existente. Trabalho na branch `develop`,
visível localmente via `npm run dev:mock`.

## Direção visual (aprovada)

- **Estilo:** gamificado tátil, gamificação **equilibrada** (jogo como textura; conteúdo do
  dia como herói).
- **Linguagem "Forja":** carvão + brasa (o sistema já é *Charcoal & Ember*). Superfícies com
  **peso** (brilho no topo, sombra profunda), tipografia display expressiva (Bebas Neue) +
  corpo legível (Barlow), microinterações táteis (carimbo ao completar hábito, XP com brilho).
- **Fugir do "cara de IA":** hierarquia por tipografia e profundidade, não por caixas planas;
  paleta quente e enxuta; sem gradiente roxo genérico.

Tokens novos em `src/styles.css`: `forge-card`, `forge-raised`, `forge-press(-active)`,
animação `stamp-in`. Reaproveitam os tokens oklch e os 7 temas já existentes.

## Telas do esquema (6) e mapa de reuso

| Tela do desenho | Rota alvo | Reaproveita |
|---|---|---|
| Home / Dashboard (hub) | `/home` (nova) | `HUD`, `lib/habits`, `lib/level-tracks`, `lib/planning` |
| Seu Dia | `/calendario` (view "dia") | `lib/planning` (CalendarDay, ScheduledQuest) |
| Semana | `/calendario` (view "semana") | `lib/planning` |
| Inteligência Digital — menu | entrada em `/home` → `/ia` | `lib/ia-capture`, `*.functions` |
| Inteligência Digital — chat | `/ia` + `/orientador-chat` | `ChatThread`, `ai-gateway.server` |
| Social / Grupo | `/social` | `Feed`, `PostCard`, `GroupChat`, `lib/social` |

## Piloto entregue: Home (`/home`)

Define o sistema visual. Composição (tudo com dados do mock):

- **`HUD`** (reuso) — avatar, nome, classe, nível, barra de XP, streak, Brasas→Forja.
- **`components/home/MonthGlance`** — calendário com toggle **Mês / Semana / Dia**, hoje em
  destaque, pontinhos nos dias com atividade.
- **`components/home/HabitTrackerStrip`** — hábitos com barrinhas de progresso semanal e
  botão de "carimbo" (marca/desmarca hoje, otimista). Reusa `listHabits`/`toggleHabit`.
- **`components/home/QuickCreate`** — tiles Criar Hábito/Compromisso/Treino/Plano + "Pedido
  personalizado", levando à IA (fluxo de confirmação previsto no seu esquema).
- **FAB da Inteligência Digital** — botão flutuante (brasa pulsante) → `/ia`.

## Sequência

1. ✅ Fundação (tokens Forja) + **Home piloto**.
2. Hábitos (gestão expandida) + Calendário (Mês/Semana/Dia completos, "Seu Dia").
3. Inteligência Digital (menu + chat com áudio/anexo/histórico).
4. Social / Grupo (feed, ranking, mensagens, perfil público).

## Como visualizar

```bash
npm run dev:mock
# abrir http://localhost:3000/home
```

> Observação: `/home` é uma rota nova e não substitui `/mapa` ainda — assim dá para comparar
> o antigo e o novo lado a lado antes de trocar o padrão. "Depois podemos tentar de outro
> jeito" fica fácil: cada tela é isolada em `components/home/`.
