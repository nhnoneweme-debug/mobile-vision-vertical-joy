// Giroscópio / acelerômetro do painel Live.
//
// Lê DeviceMotion + DeviceOrientation a ~60Hz mas NUNCA persiste cru: agrega
// localmente e devolve (a) uma amostra a cada 30s com a orientação média e
// dominante e (b) eventos de cruzamento de limiar (movimento brusco).

import { useCallback, useEffect, useRef, useState } from "react";

export type MotionAggregate = {
  startedAt: string;
  endedAt: string;
  samples: number;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  dominant: "tela para cima" | "tela para baixo" | "em pé" | "inclinado" | "indefinido";
  peakAccel: number;
  avgAccel: number;
};

export type MotionSpike = { at: string; magnitude: number };

type Options = {
  enabled: boolean;
  onAggregate: (a: MotionAggregate) => void;
  onSpike: (s: MotionSpike) => void;
  /** m/s² acima da gravidade que conta como movimento brusco */
  spikeThreshold?: number;
  windowMs?: number;
};

type PermissionState = "unknown" | "granted" | "denied" | "unsupported";

type MotionEventCtor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};
type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function dominantFrom(beta: number | null, gamma: number | null): MotionAggregate["dominant"] {
  if (beta == null || gamma == null) return "indefinido";
  const ab = Math.abs(beta);
  const ag = Math.abs(gamma);
  if (ab < 20 && ag < 20) return "tela para cima";
  if (ab > 160) return "tela para baixo";
  if (ab > 60 && ab < 120) return "em pé";
  return "inclinado";
}

export function useDeviceMotionAggregator({
  enabled,
  onAggregate,
  onSpike,
  spikeThreshold = 6,
  windowMs = 30_000,
}: Options) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [live, setLive] = useState<{ magnitude: number; dominant: MotionAggregate["dominant"] }>({
    magnitude: 0,
    dominant: "indefinido",
  });
  const [error, setError] = useState<string | null>(null);

  const bucket = useRef({
    n: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    lastAlpha: null as number | null,
    lastBeta: null as number | null,
    lastGamma: null as number | null,
    peak: 0,
    accelSum: 0,
    accelN: 0,
    startedAt: Date.now(),
  });
  const lastSpikeRef = useRef(0);
  const onAggRef = useRef(onAggregate);
  const onSpikeRef = useRef(onSpike);
  onAggRef.current = onAggregate;
  onSpikeRef.current = onSpike;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const has = "DeviceMotionEvent" in window || "DeviceOrientationEvent" in window;
    setSupported(has);
    if (!has) setPermission("unsupported");
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const M = (window as unknown as { DeviceMotionEvent?: MotionEventCtor }).DeviceMotionEvent;
    const O = (window as unknown as { DeviceOrientationEvent?: OrientationEventCtor })
      .DeviceOrientationEvent;
    try {
      if (M?.requestPermission) {
        const r = await M.requestPermission();
        if (r !== "granted") {
          setPermission("denied");
          return false;
        }
      }
      if (O?.requestPermission) await O.requestPermission();
      setPermission("granted");
      return true;
    } catch {
      setPermission("denied");
      setError("Permissão de sensores negada pelo navegador.");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (!supported) return;

    let cancelled = false;
    bucket.current = {
      n: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
      lastAlpha: null,
      lastBeta: null,
      lastGamma: null,
      peak: 0,
      accelSum: 0,
      accelN: 0,
      startedAt: Date.now(),
    };

    const onOrientation = (ev: DeviceOrientationEvent) => {
      const b = bucket.current;
      if (ev.alpha == null && ev.beta == null && ev.gamma == null) return;
      b.n += 1;
      b.alpha += ev.alpha ?? 0;
      b.beta += ev.beta ?? 0;
      b.gamma += ev.gamma ?? 0;
      b.lastAlpha = ev.alpha;
      b.lastBeta = ev.beta;
      b.lastGamma = ev.gamma;
    };

    const onMotion = (ev: DeviceMotionEvent) => {
      const a = ev.acceleration ?? ev.accelerationIncludingGravity;
      if (!a) return;
      const withGravity = !ev.acceleration;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const net = withGravity ? Math.abs(mag - 9.81) : mag;
      const b = bucket.current;
      b.accelSum += net;
      b.accelN += 1;
      if (net > b.peak) b.peak = net;
      setLive((prev) =>
        Math.abs(prev.magnitude - net) > 0.3 ? { ...prev, magnitude: net } : prev,
      );
      const now = Date.now();
      if (net >= spikeThreshold && now - lastSpikeRef.current > 4000) {
        lastSpikeRef.current = now;
        onSpikeRef.current({ at: new Date(now).toISOString(), magnitude: Number(net.toFixed(2)) });
      }
    };

    const flush = () => {
      if (cancelled) return;
      const b = bucket.current;
      const endedAt = Date.now();
      const alpha = b.n ? Number((b.alpha / b.n).toFixed(1)) : null;
      const beta = b.n ? Number((b.beta / b.n).toFixed(1)) : null;
      const gamma = b.n ? Number((b.gamma / b.n).toFixed(1)) : null;
      const dominant = dominantFrom(beta, gamma);
      setLive((p) => ({ ...p, dominant }));
      if (b.n > 0 || b.accelN > 0) {
        onAggRef.current({
          startedAt: new Date(b.startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          samples: Math.max(b.n, b.accelN),
          alpha,
          beta,
          gamma,
          dominant,
          peakAccel: Number(b.peak.toFixed(2)),
          avgAccel: b.accelN ? Number((b.accelSum / b.accelN).toFixed(2)) : 0,
        });
      }
      bucket.current = {
        n: 0,
        alpha: 0,
        beta: 0,
        gamma: 0,
        lastAlpha: b.lastAlpha,
        lastBeta: b.lastBeta,
        lastGamma: b.lastGamma,
        peak: 0,
        accelSum: 0,
        accelN: 0,
        startedAt: endedAt,
      };
    };

    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    const id = window.setInterval(flush, windowMs);

    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
      window.clearInterval(id);
    };
  }, [enabled, supported, spikeThreshold, windowMs]);

  return { supported, permission, requestPermission, live, error };
}
