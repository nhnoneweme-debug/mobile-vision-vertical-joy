
# Manifestação Viva da WiMi — Foreground + Push em segundo plano

Duas camadas complementares. Foreground é a experiência rica (voz, vibração, microfone). Push cobre o caso "celular travado / outro app aberto".

---

## Camada 1 — Foreground (app aberto no `/assistente` ou em qualquer outra tela)

### 1.1 Handler completo no `/assistente` (já é o palco natural)
Quando `JourneyAgent` chama `onManifest({ phase, block, suggestions, message })`:
1. Injeta a mensagem no thread da WiMi com os 3 botões de sugestão (já existe).
2. **Vibra**: `navigator.vibrate` com padrão por fase (`preEnd` curto, `atEnd` longo, `preStart` duplo). No-op onde não suportado.
3. **Fala**: reusa o pipeline TTS atual (`sanitizeForTts` + `<audio>` global + `ttsGenRef`).
4. **Beep de atenção** (WebAudio, 2 notas curtas) quando o TTS está desligado — evita silêncio total.
5. **Microfone pronto**: após o TTS terminar (`onended`), chama `startListening()` por ~15s. Encerra sozinho se o usuário não falar.
6. **Foco visual**: card da manifestação com borda `ember` + `animate-pulse` por 3s.

### 1.2 `JourneyAgent` global no `MobileShell`
Hoje o agente só roda dentro do `/assistente`. Vamos montar uma instância leve no shell:
- Se rota atual é `/assistente` → agente do shell fica em no-op (flag `window.__wimiJourneyOwner` marca quem manda), assistente cuida.
- Em qualquer outra rota autenticada → agente do shell dispara: vibração + beep + `toast` sonoro com CTA "Falar com WiMi" que navega para `/assistente?seed=manifest:<blockId>:<phase>`. O assistente lê o seed no mount e injeta a mensagem/ações imediatamente.

### 1.3 Acordos por modalidade (extensão do que já existe)
Estender `JourneyAgreements` com flags booleanas (padrão true):
```ts
notify: { text: true, voice: true, vibrate: true, autoMic: true }
```
Editáveis como 4 switches no painel de ajustes da jornada (mesma seção onde já existem os sliders `preEnd/atEnd/preStart`). Persistidos no mesmo localStorage.

---

## Camada 2 — Web Push (tela travada, outro app, aba em background)

Reusa a infra que **já existe**: `public/push-sw.js`, `src/lib/push.server.ts` (com `webpush` e VAPID), tabela `push_subscriptions`, prefs em `notification_prefs`, rota `src/routes/api/public/hooks/push-notification.ts`.

### 2.1 Migration: agendador de push da jornada
Criar `journey_push_schedule`:
```sql
CREATE TABLE public.journey_push_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.user_missions(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('preEnd','atEnd','preStart')),
  fire_at timestamptz NOT NULL,       -- momento absoluto pra tocar
  tz text NOT NULL,                   -- fuso do device no momento do agendamento
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (mission_id, phase, fire_at)
);
```
+ GRANTs padrão + RLS (`user_id = auth.uid()` para SELECT/DELETE; INSERT/UPDATE só via service_role no cron).

Índice: `(fire_at) WHERE sent_at IS NULL`.

### 2.2 Server fn `syncJourneyPushSchedule` (autenticada)
Chamada **do cliente**:
- Quando `useActiveJourney` carrega as missões do dia.
- Quando o usuário edita os acordos de tempo.
- Após criar/editar/concluir uma missão.

Recebe as missões do dia + acordos + fuso (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Faz `DELETE` dos slots futuros ainda não enviados e `INSERT` dos novos `(mission_id, phase, fire_at)` calculados a partir de `scheduled_time`/`end_time`. Só agenda `fire_at > now()`.

### 2.3 Rota pública `/api/public/hooks/journey-tick`
- Auth: mesmo padrão do `push-notification.ts` (`x-webhook-secret` + `timingSafeEqual`).
- Lê `journey_push_schedule` com `fire_at <= now()` e `sent_at IS NULL` (limite 200/tick).
- Para cada linha: `sendPushToUser` com `kind = 'mission_due' | 'ritual'` (para respeitar `notification_prefs.allow_*` e quiet hours já implementados em `push.server.ts`). URL do push → `/assistente?seed=manifest:<mission_id>:<phase>`.
- Marca `sent_at = now()`.

### 2.4 Cron
```sql
select cron.schedule(
  'wimi-journey-tick', '* * * * *',
  $$ select net.http_post(
    url:='https://project--b3f7344d-...lovable.app/api/public/hooks/journey-tick',
    headers:='{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}'::jsonb,
    body:='{}'::jsonb) $$
);
```

### 2.5 Contrato com o SW e reentrada
`push-sw.js` já mostra notificação e navega para a `url` do payload. Ao abrir via push, o `/assistente` lê o seed `manifest:<blockId>:<phase>` e:
- Renderiza a manifestação imediatamente (mesmo handler da Camada 1).
- Marca `wasFired` para evitar duplicar quando o `JourneyAgent` local tentar disparar em seguida.

### 2.6 Prefs & privacidade
- Reusa `notification_prefs` existente (push_enabled, quiet_start/end, allow_mission/allow_ritual). Nada novo.
- Push só envia se o usuário tiver `push_subscriptions` (endpoint já disponível em Preferências).
- iOS: Web Push só funciona com PWA instalado (iOS 16.4+). Explicar no card de ajustes da jornada, sem alarde.

---

## Arquivos

**Novos**
- `src/components/assistente/JourneyManifestFX.ts` — helpers puros: `vibrateFor(phase)`, `playPing()`.
- `src/lib/journey-schedule.functions.ts` — `syncJourneyPushSchedule` (server fn autenticada).
- `src/routes/api/public/hooks/journey-tick.ts` — cron endpoint.
- Migration `journey_push_schedule` + GRANTs + RLS + índice.

**Editados**
- `src/lib/journey-agreements.ts` — adicionar `notify` no tipo/loader/saver.
- `src/routes/_authenticated/assistente.tsx` — `handleManifest` completo (vibra + fala + mic + beep), 4 switches de modalidade no settings sheet, ler `seed=manifest:...` no mount, chamar `syncJourneyPushSchedule` quando missões/acordos mudarem.
- `src/components/shell/MobileShell.tsx` — montar `JourneyAgent` global com handler leve (toast + vibra + CTA), suprimido quando `/assistente` está ativo.
- `src/hooks/useActiveJourney.ts` — expor um sinal (`missions` hash + timestamp) para o assistente saber quando re-sincronizar o schedule.

**Cron/config**
- Agendar `wimi-journey-tick` via `supabase--insert` após deploy do endpoint. `WEBHOOK_SECRET` já existe no projeto (mesma variável usada por `push-notification.ts`).

## Ordem de implementação
1. Migration + GRANTs/RLS.
2. Camada 1 completa (FX + handler + switches + shell global).
3. `syncJourneyPushSchedule` + `journey-tick` + cron.
4. Suporte a `seed=manifest:...` no `/assistente` (fecha o ciclo push→app).

## Fora de escopo
- Alarme de tela travada tipo despertador do SO (só `useWakeAlarmScheduler` existente cobre isso).
- Persistir `notify` no banco (fica em localStorage como o resto dos acordos).
- SMS/WhatsApp.
