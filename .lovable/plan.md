# Despertar Inteligente + Ponte para Execução

Fluxo unificado que a WiMi conduz do alarme até o painel de execução:

```text
[Alarme dispara] → [Ringing UI + áudio + vibração]
      ↓ snooze (5/10/15) ─── volta a tocar
      ↓ "acordei"
[Registro rápido de sonho/pesadelo] (pode pular)
      ↓
[Planejamento do dia]
   ├── já existe plano → confirma e vai p/ execução
   └── vazio → WiMi propõe (usa /assistente seed=planejar)
      ↓
[/executar em modo painel]
   Colunas: A Fazer • Agora • Concluído
   Cada card mostra planejado × executado (hora real, notas)
```

## Escopo (só o que falta / novo)

Muito da base já existe (`wake_alarms`, `wake_sessions`, `dream_logs`, `day_blocks`, `scheduled_quests`, `user_missions`, rotas `/despertar` e `/dormir`, server fns em `wake.functions.ts`, `/executar`). Vamos **conectar** e adicionar o que estiver faltando.

### 1. Alarme em foreground (client-side)
Novo hook `useWakeAlarmScheduler` no `MobileShell`:
- Lê `wake_alarms` habilitados do usuário logado.
- Timer verifica a cada 30s se `time_local` do dia atual bateu (respeita `days_of_week` e TZ do device).
- Ao bater: chama `startWakeSession` e navega para `/despertar/ringing`.
- Guardas: só dispara 1x por alarme/dia (marca em `localStorage: wimi:alarm-fired:{id}:{yyyy-mm-dd}`).

Observação honesta: alarme confiável com app fechado exige push nativo/background — fora do escopo web. Aqui funciona com o app aberto/PWA em foreground (mesmo comportamento de outros alarmes web).

### 2. Rota `/despertar/ringing` (nova)
Tela cheia com:
- Hora grande + label do alarme.
- Áudio em loop (arquivo em `/public/sounds/wake-gentle.mp3` — arquivo pequeno gerado).
- `navigator.vibrate([600, 300, 600, 300, 800])` em loop (best-effort).
- Botões: **Voltar em 5 / 10 / 15 min** (chama `recordSnooze` e agenda re-toque via `setTimeout` local) e **Acordei** (chama `markAwake` e navega para `/despertar/sonho`).
- Fala da WiMi (TTS existente): saudação curta + "posso voltar em 10 minutos ou já começar seu dia".

### 3. Rota `/despertar/sonho` (nova, curta)
- Textarea rápido "o que sonhou?" + chips (bom / neutro / pesadelo / não lembro).
- Botão salvar → `logDream` → segue para `/despertar/planejar`.
- Botão pular → segue direto.

### 4. Rota `/despertar/planejar` (nova, roteador)
- Chama `scheduled_quests + user_missions` para hoje.
- Se **há plano** → mostra resumo compacto + CTA "Ir executar".
- Se **vazio** → CTA "Planejar com a WiMi" (`/assistente?seed=planejar-dia`) e "Pular".
- Redireciona para `/executar` ao fim.

### 5. `/executar` — planejado × executado
Ajuste na rota existente:
- Cada card já mostra hora prevista; adicionar linha "✓ feito às HH:MM" quando `user_mission_logs`/`day_blocks` tiverem execução real.
- Coluna "Agora" = itens cuja janela horária engloba `now()`.
- Manter Kanban atual (A Fazer • Agora • Concluído).

### 6. Ajustes menores
- Painel "Caminhos" já tem entrada "Descansar" — adicionar "Despertar" apontando para `/despertar` (config de alarmes).
- Rota `/_authenticated/despertar` atual (DumpChat morning) vira **configuração** de alarmes + entrada manual "acordar agora".

## Detalhes técnicos

Arquivos novos:
- `src/hooks/useWakeAlarmScheduler.ts`
- `src/routes/_authenticated/despertar.ringing.tsx`
- `src/routes/_authenticated/despertar.sonho.tsx`
- `src/routes/_authenticated/despertar.planejar.tsx`
- `public/sounds/wake-gentle.mp3` (tom suave curto, ~200KB, gerado)

Arquivos alterados:
- `src/components/shell/MobileShell.tsx` — monta o scheduler.
- `src/routes/_authenticated/despertar.tsx` — troca DumpChat por gestor de alarmes (lista + toggle + novo, usando `listAlarms/upsertAlarm/deleteAlarm`).
- `src/routes/_authenticated/executar.tsx` — badge "planejado × executado".
- `src/components/home/panels/CaminhosPanel.tsx` — tile "Despertar".
- `src/routes/api/assistant.ts` — aceitar `seed=planejar-dia` no system prompt (já existe seed handler).

Sem migração de banco: todas as tabelas já existem (`wake_alarms`, `wake_sessions`, `wake_events`, `dream_logs`, `day_blocks`, `scheduled_quests`, `user_missions`, `user_mission_logs`).

Nenhum secret novo. Nenhum custo de IA extra além do TTS já usado.

Ao aprovar, implemento na ordem: gestor de alarmes → scheduler → ringing → sonho → planejar → ajustes em /executar e Caminhos.
