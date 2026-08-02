// Relógio único da sessão Live.
// O painel Live registra aqui o instante de início da sessão; o motor de
// gatilhos, o overlay de próximas ações e o diagnóstico do Studio leem o mesmo
// valor — assim a contagem regressiva bate em todas as abas.

import { useEffect, useState } from "react";

let sessionStart = Date.now();
const listeners = new Set<(v: number) => void>();

export function setLiveSessionStart(ts: number) {
  if (sessionStart === ts) return;
  sessionStart = ts;
  for (const l of listeners) l(ts);
}

export function getLiveSessionStart() {
  return sessionStart;
}

export function useLiveSessionStart(): number {
  const [v, setV] = useState(sessionStart);
  useEffect(() => {
    listeners.add(setV);
    setV(sessionStart);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/** Re-render a cada segundo — usado por contagens regressivas. */
export function useSecondsTick(): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}
