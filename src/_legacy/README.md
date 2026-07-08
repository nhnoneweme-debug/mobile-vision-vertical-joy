# src/_legacy — código antigo preservado

Esta pasta guarda telas/componentes do **layout antigo** que **não são mais usados como
rota**, mas ficam preservados para consulta e para reaproveitar funções/ideias na versão nova.

- **`MapaLegacy.tsx`** — a antiga "home" (Mapa): HUD + quest do dia + atalhos (ritual,
  calendário, conquistas) + grade de áreas (Bento). A rota `/mapa` agora só redireciona
  para `/home` (`src/routes/_authenticated/mapa.tsx`); o layout novo está em
  `src/routes/_authenticated/home.tsx` + `src/components/home/*`.

## Como reaproveitar algo daqui

1. Copie o trecho/função desejado para a versão nova (`components/home/*` ou a rota nova).
2. Ajuste ao design "Forja" (tokens `forge-card`, etc.).
3. Não importe arquivos desta pasta em código de produção — trate como referência.

> Nada aqui é carregado pelo app. Componentes compartilhados que continuam em uso
> (ex.: `components/map/HUD`, `QuestOfDayCard`, `BentoArea`, `areas`) permanecem em
> `src/components/map/` porque outras telas os utilizam.
