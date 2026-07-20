# Home Studio — Painel "Caminhos do Mentor"

## Visão

Transformar a Home em uma superfície configurável ("Estúdio Interno") onde o usuário escolhe qual painel central quer ver. Primeiro painel entregue: **Caminhos**, um guia com 6 rotas que orientam a jornada holística com a WiMi como mentora.

Os caminhos:
- **Planejar** — abre a IA com prompt-seed de planejamento holístico
- **Executar** — kanban simples dos planos ativos, puxando das metas/scheduled quests
- **Refletir** — abre reflexão guiada com base em journal, dreams e logs
- **Descansar** — mapeia + registra descanso pessoal (rituais, sono, pausas)
- **Agenda** — mostra a agenda/calendário atual embutido no painel
- **Grupos** — família, amigos, relacionamentos com análise cruzada

## Escopo desta entrega (v1)

1. **Fundação de Estúdio** (mínima, extensível)
   - Novo componente `HomeStudio.tsx` que substitui o bloco fixo do meio da Home.
   - Persistência local por enquanto (localStorage `wimi:home:panel`) — evita migration pesada; um segundo turno pode promover pra `profiles.home_layout` quando validarmos.
   - API interna simples: `type HomePanel = "caminhos" | "agenda" | "habitos"`. Só "caminhos" e "agenda" ficam disponíveis nesta versão; a arquitetura já aceita novos painéis.
   - Botão discreto "Estúdio" (ícone Settings2) no header do painel abre Sheet com as opções.

2. **Painel "Caminhos"** (default)
   - Grid 2×3 de tiles grandes, mesma linguagem visual do `TrackingShortcuts` (forge-card, ember icon).
   - Ícones: Compass (Planejar), ListChecks (Executar), Sparkles (Refletir), Moon (Descansar), CalendarDays (Agenda), Users2 (Grupos).
   - Cada tile abre um destino:
     - Planejar → `/assistente?seed=planejar`
     - Executar → `/assistente?seed=executar` (v1) — evolui pra kanban dedicado depois
     - Refletir → `/mental` (já existe journal/dreams)
     - Descansar → `/dormir` (já existe rituais/sono)
     - Agenda → troca o painel local pra "agenda" (sem sair da Home)
     - Grupos → `/circulo`
   - Prompt-seed: `/assistente` já consome `event ia:seed` — adicionamos leitura de `?seed=` como fallback e mapeamos cada seed pra um texto inicial ("Vamos planejar juntos. Comece me contando qual área da sua vida você quer estruturar hoje: trabalho, emocional, espiritual, físico ou relacionamentos?" etc.).

3. **Painel "Agenda" embutido**
   - Quando selecionado, o meio da Home mostra o `MonthGlance` em versão expandida + próximos 3 compromissos (`listScheduled` da semana). Sem duplicar código da rota `/agenda`.

4. **Substituições na Home**
   - `TrackingShortcuts` continua abaixo (Treino/Plano Alimentar são atalhos de execução).
   - `HabitTrackerStrip` continua.
   - O `MonthGlance` sai da posição fixa: passa a ser conteúdo do painel "agenda". Enquanto o painel ativo for "caminhos", ele não aparece — o grid de Caminhos ocupa o espaço.

## Detalhes técnicos

Arquivos novos:
- `src/components/home/HomeStudio.tsx` — orquestrador (lê localStorage, renderiza painel ativo, botão estúdio)
- `src/components/home/panels/CaminhosPanel.tsx` — grid 2×3
- `src/components/home/panels/AgendaPanel.tsx` — MonthGlance + próximos eventos
- `src/components/home/StudioSheet.tsx` — Sheet com escolha de painel

Arquivos alterados:
- `src/routes/_authenticated/home.tsx` — substitui `<MonthGlance />` por `<HomeStudio />`
- `src/routes/_authenticated/assistente.tsx` — lê `search.seed` e injeta prompt inicial no composer

Tokens/estilo: reutiliza `forge-card`, `forge-press`, `text-ember`, `font-display`. Sem novas cores.

Sem mudanças de banco. Sem migrations. Sem novos secrets. Sem alteração de RLS.

## Fora do escopo (próximos turnos)
- Kanban real de execução com colunas Backlog/Hoje/Feito puxando `scheduled_quests` + `strategic_goals`.
- Módulo "Descansar" dedicado (mapeamento + práticas) — v1 reusa `/dormir`.
- Grupos "família" com análise cruzada — v1 reusa `/circulo`.
- Persistência de layout em `profiles.home_layout` + drag-and-drop de painéis.
- Múltiplos painéis empilhados / ordem customizável.
