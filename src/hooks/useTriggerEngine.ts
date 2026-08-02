// Avaliador de gatilhos em tempo real (roda dentro do painel Live).
//
// Percorre os gatilhos habilitados EM ORDEM (position) a cada sinal e executa
// a primeira ação correspondente. Respeita cooldown por gatilho e idempotência
// por evento de origem (source_ref). Live pausado = avaliador pausado.

import { useCallback, useEffect, useRef } from "react";
import {
  MAX_CHAIN_DEPTH,
  isWithinWindow,
  keywordMatches,
  recordFiring,
  updateTrigger,
  type TriggerAction,
  type TriggerDefinition,
} from "@/lib/triggers";

export type LiveSignals = {
  /** avaliador ativo (Live aberto e não pausado) */
  active: boolean;
  sessionStartedAt: number;
  lastBlock: { id: string; text: string } | null;
};

export type TriggerControls = {
  applyAction: (action: TriggerAction, trigger: TriggerDefinition) => void;
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
          meta,
        }).catch(() => {});
        onFired?.();
        return;
      }

      lastFireRef.current[t.id] = now;
      const action = t.action ?? {};
      let result: "executed" | "failed" = "executed";
      try {
        controlsRef.current.applyAction(action, t);
      } catch {
        result = "failed";
      }
      void recordFiring({
        trigger_id: t.id,
        source_kind: sourceKind,
        source_ref: sourceRef,
        result,
        meta,
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

  // --------------------------------------------------- eventos de ÁUDIO
  useEffect(() => {
    if (!signals.active || !signals.lastBlock) return;
    const block = signals.lastBlock;
    for (const t of enabled()) {
      const c = t.condition as Record<string, unknown>;
      if (c?.source !== "audio" || typeof c.keyword !== "string") continue;
      if (!keywordMatches(block.text, c.keyword)) continue;
      fire(t, "audio", `block:${block.id}`, { keyword: c.keyword, text: block.text.slice(0, 300) });
    }
  }, [signals.active, signals.lastBlock, enabled, fire]);

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
