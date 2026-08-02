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
  const [inIframe, setInIframe] = useState(false);
  // Diagnóstico honesto: quantos eventos de sensor chegaram de verdade.
  const [diag, setDiag] = useState({ eventsPerSec: 0, totalEvents: 0, blocked: false });
  // Leitura ao vivo (só UI — nada disso vai pro banco): magnitude instantânea,
  // nível 0..1 suavizado e orientação dominante reagindo em tempo real.
  const [live, setLive] = useState<{
    magnitude: number;
    level: number;
    dominant: MotionAggregate["dominant"];
    beta: number | null;
    gamma: number | null;
    updatedAt: number;
  }>({ magnitude: 0, level: 0, dominant: "indefinido", beta: null, gamma: null, updatedAt: 0 });
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
  const liveRef = useRef({
    magnitude: 0,
    level: 0,
    dominant: "indefinido" as MotionAggregate["dominant"],
    beta: null as number | null,
    gamma: null as number | null,
  });
  const lastPaintRef = useRef(0);
  const eventCountRef = useRef(0);
  const totalEventsRef = useRef(0);
  const prevOrientRef = useRef<{ beta: number | null; gamma: number | null }>({
    beta: null,
    gamma: null,
  });
  const onAggRef = useRef(onAggregate);
  const onSpikeRef = useRef(onSpike);
  onAggRef.current = onAggregate;
  onSpikeRef.current = onSpike;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const has = "DeviceMotionEvent" in window || "DeviceOrientationEvent" in window;
    setSupported(has);
    if (!has) setPermission("unsupported");
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const M = (window as unknown as { DeviceMotionEvent?: MotionEventCtor }).DeviceMotionEvent;
    const O = (window as unknown as { DeviceOrientationEvent?: OrientationEventCtor })
      .DeviceOrientationEvent;
    try {
      // iOS: precisa acontecer DENTRO do gesto do usuário — por isso este
      // método é chamado direto no onClick do botão "Ativar".
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
    eventCountRef.current = 0;
    totalEventsRef.current = 0;
    prevOrientRef.current = { beta: null, gamma: null };
    setDiag({ eventsPerSec: 0, totalEvents: 0, blocked: false });

    // Repinta a UI no máximo ~20x/s: tempo real na tela, sem travar o render.
    const paint = () => {
      const now = Date.now();
      if (now - lastPaintRef.current < 50) return;
      lastPaintRef.current = now;
      setLive({ ...liveRef.current, updatedAt: now });
    };

    // Decaimento do nível quando o aparelho fica parado.
    const decay = window.setInterval(() => {
      if (cancelled) return;
      if (liveRef.current.level > 0.005) {
        liveRef.current.level *= 0.75;
        liveRef.current.magnitude *= 0.75;
        lastPaintRef.current = 0;
        paint();
      }
    }, 250);

    // Contador de eventos/s + detecção honesta de bloqueio (iframe sem
    // Permissions-Policy, contexto inseguro etc.).
    const startedAt = Date.now();
    const diagTimer = window.setInterval(() => {
      if (cancelled) return;
      const eps = eventCountRef.current;
      eventCountRef.current = 0;
      setDiag({
        eventsPerSec: eps,
        totalEvents: totalEventsRef.current,
        blocked: totalEventsRef.current === 0 && Date.now() - startedAt > 2500,
      });
    }, 1000);

    const bump = () => {
      eventCountRef.current += 1;
      totalEventsRef.current += 1;
    };

    const onOrientation = (ev: DeviceOrientationEvent) => {
      const b = bucket.current;
      if (ev.alpha == null && ev.beta == null && ev.gamma == null) return;
      bump();
      b.n += 1;
      b.alpha += ev.alpha ?? 0;
      b.beta += ev.beta ?? 0;
      b.gamma += ev.gamma ?? 0;
      b.lastAlpha = ev.alpha;
      b.lastBeta = ev.beta;
      b.lastGamma = ev.gamma;

      // Alguns aparelhos/navegadores só entregam deviceorientation (sem
      // acceleration útil). Nesses casos a variação angular alimenta a barra,
      // senão o indicador ficaria morto mesmo com o sensor vivo.
      const prev = prevOrientRef.current;
      if (prev.beta != null && prev.gamma != null && ev.beta != null && ev.gamma != null) {
        const d = Math.abs(ev.beta - prev.beta) + Math.abs(ev.gamma - prev.gamma);
        if (d > 0.4) {
          const angleLevel = Math.min(1, d / 25);
          if (angleLevel > liveRef.current.level) liveRef.current.level = angleLevel;
        }
      }
      prevOrientRef.current = { beta: ev.beta, gamma: ev.gamma };

      liveRef.current.beta = ev.beta;
      liveRef.current.gamma = ev.gamma;
      liveRef.current.dominant = dominantFrom(ev.beta, ev.gamma);
      paint();
    };

    const onMotion = (ev: DeviceMotionEvent) => {
      const a = ev.acceleration ?? ev.accelerationIncludingGravity;
      if (!a) return;
      bump();
      const hasNet = !!(ev.acceleration && (a.x || a.y || a.z));
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const net = hasNet ? mag : Math.abs(mag - 9.81);
      const b = bucket.current;
      b.accelSum += net;
      b.accelN += 1;
      if (net > b.peak) b.peak = net;
      liveRef.current.magnitude = net;
      liveRef.current.level = Math.min(1, Math.max(liveRef.current.level * 0.7, net / 12));
      paint();
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

    window.addEventListener("deviceorientation", onOrientation, true);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.addEventListener("devicemotion", onMotion, true);
    const id = window.setInterval(flush, windowMs);

    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientation", onOrientation, true);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
      window.removeEventListener("devicemotion", onMotion, true);
      window.clearInterval(id);
      window.clearInterval(decay);
      window.clearInterval(diagTimer);
    };
  }, [enabled, supported, spikeThreshold, windowMs]);

  return { supported, permission, requestPermission, live, error, diag, inIframe };
}

