// Avaliador de gatilhos em tempo real (roda dentro do painel Live).
//
// Percorre os gatilhos habilitados EM ORDEM (position) a cada sinal e executa
// a primeira ação correspondente. Respeita cooldown por gatilho e idempotência
// por evento de origem (source_ref). Live pausado = avaliador pausado.

import { useCallback, useEffect, useRef } from "react";
import {
  MAX_CHAIN_DEPTH,
  findKeyword,
  isWithinWindow,
  recordFiring,
  updateTrigger,
  type ActionResult,
  type TriggerAction,
  type TriggerDefinition,
} from "@/lib/triggers";

export type LiveSignals = {
  /** avaliador ativo (Live aberto e não pausado) */
  active: boolean;
  sessionStartedAt: number;
  lastBlock: { id: string; text: string } | null;
  /**
   * TEXTO OUVIDO AO VIVO (final + parcial do reconhecedor). É AQUI que os
   * comandos de voz casam — continuamente, sem esperar o bloco de 15s fechar.
   * `epoch` muda a cada bloco fechado, reiniciando as âncoras de dedupe.
   */
  liveText?: { text: string; epoch: number };
  /**
   * ÚLTIMO EVENTO DISCRETO da sessão (início, bloco fechado, silêncio, registro
   * manual). `ref` é único por ocorrência e serve de âncora de idempotência.
   */
  event?: { name: string; ref: string; meta?: Record<string, unknown> } | null;
};

export type TriggerControls = {
  applyAction: (
    action: TriggerAction,
    trigger: TriggerDefinition,
    meta?: { matched_text?: string },
  ) => ActionResult[] | void;
};

export function useTriggerEngine(
  triggers: TriggerDefinition[],
  signals: LiveSignals,
  controls: TriggerControls,
  onFired?: () => void,
) {
  const lastFireRef = useRef<Record<string, number>>({});
  const doneRefsRef = useRef<Set<string>>(new Set());
  const triggersRef = useRef(triggers);
  const signalsRef = useRef(signals);
  const controlsRef = useRef(controls);
  triggersRef.current = triggers;
  signalsRef.current = signals;
  controlsRef.current = controls;

  const fireRef = useRef<
    (
      t: TriggerDefinition,
      sourceKind: string,
      sourceRef: string,
      meta: Record<string, unknown>,
      depth?: number,
    ) => void
  >(() => {});

  const fire = useCallback(
    (
      t: TriggerDefinition,
      sourceKind: string,
      sourceRef: string,
      meta: Record<string, unknown>,
      depth = 0,
    ) => {
      const key = `${t.id}:${sourceRef}`;
      if (doneRefsRef.current.has(key)) return;
      doneRefsRef.current.add(key);

      const now = Date.now();
      const last = lastFireRef.current[t.id] ?? 0;
      const cooling = now - last < (t.cooldown_seconds ?? 30) * 1000;
      if (cooling) {
        void recordFiring({
          trigger_id: t.id,
          source_kind: sourceKind,
          source_ref: sourceRef,
          result: "suppressed_cooldown",
          meta: {
            ...meta,
            action_results: [],
            cooldown_seconds: t.cooldown_seconds,
            cooldown_remaining_ms: (t.cooldown_seconds ?? 30) * 1000 - (now - last),
          },
        }).catch(() => {});

        onFired?.();
        return;
      }

      lastFireRef.current[t.id] = now;
      const action = t.action ?? {};
      let result: "executed" | "failed" = "executed";
      let actionResults: ActionResult[] = [];
      try {
        actionResults =
          controlsRef.current.applyAction(action, t, {
            matched_text: typeof meta.matched_text === "string" ? meta.matched_text : undefined,
          }) || [];
      } catch (e) {
        result = "failed";
        actionResults = [
          {
            action: "execução",
            success: false,
            detail: e instanceof Error ? e.message : "erro desconhecido",
          },
        ];
      }
      if (actionResults.some((r) => !r.success)) result = "failed";
      void recordFiring({
        trigger_id: t.id,
        source_kind: sourceKind,
        source_ref: sourceRef,
        result,
        meta: {
          ...meta,
          action_results: actionResults,
          cooldown_seconds: t.cooldown_seconds,
          cooldown_remaining_ms: 0,
          channel: "foreground",
          fired_client_at: new Date(now).toISOString(),
        },
      }).catch(() => {});

      // ------------------------------------------- encadeamento entre gatilhos
      if (action.trigger_enable?.trigger_id) {
        void updateTrigger(action.trigger_enable.trigger_id, {
          enabled: action.trigger_enable.enabled,
        }).catch(() => {});
      }
      const chainId = action.trigger_fire?.trigger_id;
      if (chainId) {
        const target = triggersRef.current.find((x) => x.id === chainId);
        if (target) {
          if (depth + 1 >= MAX_CHAIN_DEPTH) {
            void recordFiring({
              trigger_id: target.id,
              source_kind: "chain",
              source_ref: `chain:${sourceRef}:${depth + 1}`,
              result: "failed",
              meta: {
                reason: "chain_limit",
                chained_from: t.id,
                chained_from_name: t.name,
                depth: depth + 1,
              },
            }).catch(() => {});
          } else {
            fireRef.current(
              target,
              "chain",
              `chain:${sourceRef}:${depth + 1}`,
              { chained_from: t.id, chained_from_name: t.name, depth: depth + 1 },
              depth + 1,
            );
          }
        }
      }
      onFired?.();
    },
    [onFired],
  );
  fireRef.current = fire;

  const enabled = useCallback(
    () =>
      triggersRef.current
        .filter((t) => t.enabled && isWithinWindow(t.active_window))
        .sort((a, b) => a.position - b.position),
    [],
  );

  // --------------------------------------------------- COMANDOS DE VOZ
  //
  // Casamento CONTÍNUO no texto parcial do reconhecedor: assim que a frase
  // aparece no interim, o comando dispara (<2s). Dedupe pela âncora
  // `epoch:índice da ocorrência` — a mesma ocorrência nunca dispara duas
  // vezes, mas repetir a frase mais tarde (novo índice/epoch) dispara de novo.
  const liveEpoch = signals.liveText?.epoch ?? 0;
  const liveTextValue = signals.liveText?.text ?? "";
  useEffect(() => {
    if (!signals.active || !liveTextValue.trim()) return;
    for (const t of enabled()) {
      const c = t.condition as Record<string, unknown>;
      if (c?.source !== "audio" || typeof c.keyword !== "string") continue;
      const hit = findKeyword(liveTextValue, c.keyword);
      if (!hit) continue;
      fire(t, "audio", `voice:${liveEpoch}:${hit.index}`, {
        keyword: c.keyword,
        matched_text: hit.matched_text,
        heard_text: liveTextValue.slice(-300),
        heard_at: new Date().toISOString(),
        stage: "interim",
      });
    }
  }, [signals.active, liveTextValue, liveEpoch, enabled, fire]);

  // ------------------------------------------------ EVENTOS DA SESSÃO LIVE
  //
  // Sinais discretos (início, bloco fechado, silêncio, registro manual). O
  // dedupe é pela `ref` da ocorrência, então o mesmo evento nunca dispara duas
  // vezes o mesmo gatilho.
  const eventName = signals.event?.name ?? null;
  const eventRef = signals.event?.ref ?? null;
  useEffect(() => {
    if (!signals.active || !eventName || !eventRef) return;
    for (const t of enabled()) {
      const c = t.condition as Record<string, unknown>;
      if (c?.source !== "event" || c.event !== eventName) continue;
      fire(t, "event", eventRef, {
        event: eventName,
        ...(signalsRef.current.event?.meta ?? {}),
      });
    }
  }, [signals.active, eventName, eventRef, enabled, fire]);

  // ------------------------------------------------------------ CHRONOS

  useEffect(() => {
    if (!signals.active) return;
    const tick = () => {
      const s = signalsRef.current;
      const elapsed = Math.floor((Date.now() - s.sessionStartedAt) / 1000);
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const dayKey = now.toISOString().slice(0, 10);

      for (const t of enabled()) {
        const c = t.condition as Record<string, unknown>;
        if (c?.mode === "at_time") {
          if (c.time === hhmm) fire(t, "chronos", `at:${dayKey}:${hhmm}`, { time: hhmm });
        } else if (c?.mode === "every") {
          const secs = Math.max(10, Number(c.seconds ?? 60));
          const n = Math.floor(elapsed / secs);
          if (n >= 1) fire(t, "chronos", `every:${s.sessionStartedAt}:${n}`, { elapsed });
        } else if (c?.mode === "after_session") {
          const secs = Math.max(10, Number(c.seconds ?? 60));
          if (elapsed >= secs) fire(t, "chronos", `after:${s.sessionStartedAt}`, { elapsed });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [signals.active, signals.sessionStartedAt, enabled, fire]);
}
