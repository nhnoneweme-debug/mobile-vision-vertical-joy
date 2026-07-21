// Screen Wake Lock — mantém a tela ligada enquanto o toggle estiver ativo.
// Reaquire automático quando a aba volta a ficar visível (browsers soltam o
// lock ao esconder a página). Retorna estado + toggle e sinaliza suporte.

import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (t: "release", cb: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export function useWakeLock() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const desiredRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setSupported(!!(navigator as WakeLockNavigator).wakeLock);
  }, []);

  const acquire = useCallback(async () => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return false;
    try {
      const s = await nav.wakeLock.request("screen");
      sentinelRef.current = s;
      s.addEventListener("release", () => {
        sentinelRef.current = null;
        // Se o usuário ainda deseja o lock, o efeito de visibilitychange
        // vai tentar readquirir quando a aba voltar a ficar visível.
        if (!desiredRef.current) setActive(false);
      });
      setActive(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    const s = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (s && !s.released) {
      try {
        await s.release();
      } catch {
        /* noop */
      }
    }
  }, []);

  const toggle = useCallback(async () => {
    if (desiredRef.current) {
      desiredRef.current = false;
      await release();
    } else {
      desiredRef.current = true;
      const ok = await acquire();
      if (!ok) desiredRef.current = false;
    }
  }, [acquire, release]);

  // Reaquire ao voltar pra aba: navegadores soltam wake lock quando escondem.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && desiredRef.current && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [acquire]);

  // Solta no unmount pra não vazar entre sessões.
  useEffect(() => {
    return () => {
      desiredRef.current = false;
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) void s.release().catch(() => {});
    };
  }, []);

  return { active, supported, toggle };
}
