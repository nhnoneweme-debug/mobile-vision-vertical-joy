// Screen Wake Lock PERSISTENTE — o modo foco é uma preferência do usuário, não
// um estado de tela. Uma vez ligado, ele fica ligado: sobrevive à navegação
// entre rotas, ao app ir pra segundo plano, ao reload e ao fechar/reabrir a
// aba. Só desliga quando o usuário toca no botão de novo.
//
// Estratégia:
//  - a intenção mora em localStorage (fonte da verdade);
//  - o sentinel é readquirido em visibilitychange, focus, pageshow e no evento
//    "release" do próprio sentinel;
//  - se o navegador exigir gesto do usuário, um listener único de
//    pointerdown/keydown tenta de novo na primeira interação.

import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (t: "release", cb: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const PREF_KEY = "wimi.wakelock.desired.v1";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* storage opcional */
  }
}

export function useWakeLock() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const [desired, setDesired] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const desiredRef = useRef(false);
  const gestureBoundRef = useRef(false);

  const acquire = useCallback(async () => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return false;
    if (sentinelRef.current && !sentinelRef.current.released) return true;
    if (document.visibilityState !== "visible") return false;
    try {
      const s = await nav.wakeLock.request("screen");
      sentinelRef.current = s;
      setActive(true);
      s.addEventListener("release", () => {
        sentinelRef.current = null;
        // Enquanto o usuário quiser foco, seguimos "ativos" na UI e tentamos
        // readquirir assim que a página puder.
        if (!desiredRef.current) setActive(false);
        else if (document.visibilityState === "visible") void acquireRef.current();
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const acquireRef = useRef(acquire);
  acquireRef.current = acquire;

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

  // Bootstrap: suporte + preferência salva.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ok = !!(navigator as WakeLockNavigator).wakeLock;
    setSupported(ok);
    if (!ok) return;
    const pref = readPref();
    desiredRef.current = pref;
    setDesired(pref);
    if (pref) {
      setActive(true); // otimista: a UI reflete a intenção do usuário
      void acquireRef.current();
    }
  }, []);

  // Primeira interação do usuário: alguns navegadores só liberam o lock após
  // um gesto. Tentamos de novo silenciosamente.
  useEffect(() => {
    if (!supported || gestureBoundRef.current) return;
    gestureBoundRef.current = true;
    const onGesture = () => {
      if (desiredRef.current && !sentinelRef.current) void acquireRef.current();
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      gestureBoundRef.current = false;
    };
  }, [supported]);

  // Reaquisição em qualquer retomada de foco/visibilidade.
  useEffect(() => {
    const retry = () => {
      if (
        document.visibilityState === "visible" &&
        desiredRef.current &&
        !sentinelRef.current
      ) {
        void acquireRef.current();
      }
    };
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (desiredRef.current) {
      desiredRef.current = false;
      setDesired(false);
      writePref(false);
      await release();
    } else {
      desiredRef.current = true;
      setDesired(true);
      writePref(true);
      setActive(true);
      const ok = await acquireRef.current();
      if (!ok && document.visibilityState === "visible") {
        // segue desejado: a próxima interação/visibilidade tenta de novo
        setActive(true);
      }
    }
  }, [release]);

  // NÃO limpamos a preferência no unmount — o modo foco é persistente.
  useEffect(() => {
    return () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) void s.release().catch(() => {});
    };
  }, []);

  return { active: active || desired, supported, toggle };
}
