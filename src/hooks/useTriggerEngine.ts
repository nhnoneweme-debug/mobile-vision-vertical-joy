// Avaliador de gatilhos em tempo real (roda dentro do painel Live).
//
// Percorre os gatilhos habilitados EM ORDEM (position) a cada sinal e executa
// a primeira ação correspondente. Respeita cooldown por gatilho e idempotência
// por evento de origem (source_ref). Live pausado = avaliador pausado.

import { useCallback, useEffect, useRef } from "react";
import {
  isWithinWindow,
  keywordMatches,
  recordFiring,
  type TriggerAction,
  type TriggerDefinition,
} from "@/lib/triggers";


export type LiveSignals = {
  /** avaliador ativo (Live aberto e não pausado) */
  active: boolean;
  sessionStartedAt: number;
  lastBlock: { id: string; text: string } | null;
  lastSpike: { at: string; magnitude: number } | null;
  beta: number | null;
  gamma: number | null;
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
  const angleRefRef = useRef<Record<string, { beta: number; gamma: number }>>({});
  const triggersRef = useRef(triggers);
  const signalsRef = useRef(signals);
  const controlsRef = useRef(controls);
  triggersRef.current = triggers;
  signalsRef.current = signals;
  controlsRef.current = controls;

  const fire = useCallback(
    (
      t: TriggerDefinition,
      sourceKind: string,
      sourceRef: string,
      meta: Record<string, unknown>,
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
      let result: "executed" | "failed" = "executed";
      try {
        controlsRef.current.applyAction(t.action ?? {}, t);
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
      onFired?.();
    },
    [onFired],
  );

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

  // ------------------------------------------------ eventos de MOVIMENTO
  useEffect(() => {
    if (!signals.active || !signals.lastSpike) return;
    const spike = signals.lastSpike;
    for (const t of enabled()) {
      const c = t.condition as Record<string, unknown>;
      if (c?.source !== "motion" || c.kind !== "spike") continue;
      if (spike.magnitude < Number(c.min_magnitude ?? 0)) continue;
      fire(t, "motion", `spike:${spike.at}`, { magnitude: spike.magnitude });
    }
  }, [signals.active, signals.lastSpike, enabled, fire]);

  useEffect(() => {
    if (!signals.active || signals.beta == null || signals.gamma == null) return;
    const beta = signals.beta;
    const gamma = signals.gamma;
    for (const t of enabled()) {
      const c = t.condition as Record<string, unknown>;
      if (c?.source !== "motion" || c.kind !== "angle_change") continue;
      const ref = angleRefRef.current[t.id];
      if (!ref) {
        angleRefRef.current[t.id] = { beta, gamma };
        continue;
      }
      const delta = Math.max(Math.abs(beta - ref.beta), Math.abs(gamma - ref.gamma));
      if (delta >= Number(c.min_degrees ?? 30)) {
        angleRefRef.current[t.id] = { beta, gamma };
        fire(t, "motion", `angle:${Date.now()}`, { delta: Number(delta.toFixed(1)) });
      }
    }
  }, [signals.active, signals.beta, signals.gamma, enabled, fire]);

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
