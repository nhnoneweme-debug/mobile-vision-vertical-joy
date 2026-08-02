// Atuadores persistentes da WiMi (vibração + emissão de áudio).
//
// Vivem acima das rotas (montados no MobileShell) pra que o padrão continue
// rodando enquanto o usuário navega pelo app — só para quando ele desliga.
// Config (N segundos a cada M segundos) persiste em localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ActuatorMode = "timed" | "continuous";

export type ActuatorConfig = {
  /** duração do pulso, em segundos */
  onSec: number;
  /** intervalo entre pulsos, em segundos */
  everySec: number;
  /**
   * "timed" = padrão temporizado (N seg a cada M seg).
   * "continuous" = indefinido: fica ativo até o usuário desligar.
   */
  mode: ActuatorMode;
};

type ActuatorsCtx = {
  vibrationOn: boolean;
  audioOn: boolean;
  vibrationSupported: boolean;
  audioSupported: boolean;
  vibrationConfig: ActuatorConfig;
  audioConfig: ActuatorConfig;
  pulsing: { vibration: boolean; audio: boolean };
  toggleVibration: () => void;
  toggleAudio: () => void;
  setVibrationConfig: (c: ActuatorConfig) => void;
  setAudioConfig: (c: ActuatorConfig) => void;
  stopAll: () => void;
};

const STORAGE_KEY = "wimi.actuators.v1";

const DEFAULT_CONFIG: ActuatorConfig = { onSec: 1, everySec: 30, mode: "timed" };

const ActuatorsContext = createContext<ActuatorsCtx | null>(null);

function clampConfig(c: Partial<ActuatorConfig> | undefined): ActuatorConfig {
  const onSec = Math.min(10, Math.max(1, Math.round(Number(c?.onSec ?? DEFAULT_CONFIG.onSec))));
  const everySec = Math.min(
    3600,
    Math.max(5, Math.round(Number(c?.everySec ?? DEFAULT_CONFIG.everySec))),
  );
  const mode: ActuatorMode = c?.mode === "continuous" ? "continuous" : "timed";
  return { onSec, everySec: Math.max(everySec, onSec + 1), mode };
}

export function ActuatorsProvider({ children }: { children: ReactNode }) {
  const [vibrationOn, setVibrationOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [vibrationConfig, setVibrationConfigState] = useState<ActuatorConfig>(DEFAULT_CONFIG);
  const [audioConfig, setAudioConfigState] = useState<ActuatorConfig>({
    onSec: 1,
    everySec: 60,
    mode: "timed",
  });
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [pulsing, setPulsing] = useState({ vibration: false, audio: false });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Suporte + config persistida (client-only).
  useEffect(() => {
    setVibrationSupported(
      typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
    );
    setAudioSupported(
      typeof window !== "undefined" &&
        !!(
          (window as unknown as { AudioContext?: unknown }).AudioContext ||
          (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
        ),
    );
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        vibration?: Partial<ActuatorConfig>;
        audio?: Partial<ActuatorConfig>;
      };
      setVibrationConfigState(clampConfig(parsed.vibration));
      setAudioConfigState(clampConfig(parsed.audio));
    } catch {
      /* config opcional */
    }
  }, []);

  const persist = useCallback((vib: ActuatorConfig, aud: ActuatorConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ vibration: vib, audio: aud }));
    } catch {
      /* storage indisponível */
    }
  }, []);

  const setVibrationConfig = useCallback(
    (c: ActuatorConfig) => {
      const next = clampConfig(c);
      setVibrationConfigState(next);
      persist(next, audioConfig);
    },
    [audioConfig, persist],
  );

  const setAudioConfig = useCallback(
    (c: ActuatorConfig) => {
      const next = clampConfig(c);
      setAudioConfigState(next);
      persist(vibrationConfig, next);
    },
    [persist, vibrationConfig],
  );

  // Loop da vibração.
  useEffect(() => {
    if (!vibrationOn || !vibrationSupported) return;
    let cancelled = false;

    // Modo indefinido: mantém a vibração viva com pulsos longos encadeados
    // (a API limita a duração de cada chamada), sem duração pré-definida.
    if (vibrationConfig.mode === "continuous") {
      const CHUNK = 5000;
      const keepAlive = () => {
        if (cancelled) return;
        try {
          navigator.vibrate(CHUNK);
        } catch {
          /* alguns browsers bloqueiam sem gesto */
        }
      };
      keepAlive();
      setPulsing((p) => ({ ...p, vibration: true }));
      const idc = window.setInterval(keepAlive, CHUNK - 300);
      return () => {
        cancelled = true;
        window.clearInterval(idc);
        try {
          navigator.vibrate(0);
        } catch {
          /* noop */
        }
        setPulsing((p) => ({ ...p, vibration: false }));
      };
    }

    const fire = () => {
      if (cancelled) return;
      try {
        navigator.vibrate(vibrationConfig.onSec * 1000);
      } catch {
        /* alguns browsers bloqueiam sem gesto */
      }
      setPulsing((p) => ({ ...p, vibration: true }));
      window.setTimeout(() => {
        if (!cancelled) setPulsing((p) => ({ ...p, vibration: false }));
      }, vibrationConfig.onSec * 1000);
    };
    fire();
    const id = window.setInterval(fire, vibrationConfig.everySec * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      try {
        navigator.vibrate(0);
      } catch {
        /* noop */
      }
      setPulsing((p) => ({ ...p, vibration: false }));
    };
  }, [vibrationOn, vibrationSupported, vibrationConfig]);

  // Loop do áudio (tom suave via Web Audio).
  useEffect(() => {
    if (!audioOn || !audioSupported) return;
    let cancelled = false;

    const getCtx = () => {
      if (!audioCtxRef.current) {
        const Ctor =
          (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
      }
      return audioCtxRef.current;
    };

    const fire = () => {
      if (cancelled) return;
      const ctx = getCtx();
      if (!ctx) return;
      void ctx.resume().catch(() => {});
      const dur = audioConfig.onSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 432;
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.08);
      gain.gain.setValueAtTime(0.12, t0 + Math.max(0.1, dur - 0.15));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      setPulsing((p) => ({ ...p, audio: true }));
      window.setTimeout(() => {
        if (!cancelled) setPulsing((p) => ({ ...p, audio: false }));
      }, dur * 1000);
    };

    if (audioConfig.mode === "continuous") {
      const ctx = getCtx();
      if (!ctx) return;
      void ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 432;
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      setPulsing((p) => ({ ...p, audio: true }));
      return () => {
        cancelled = true;
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
          osc.stop(ctx.currentTime + 0.2);
        } catch {
          /* já parado */
        }
        setPulsing((p) => ({ ...p, audio: false }));
      };
    }

    fire();
    const id = window.setInterval(fire, audioConfig.everySec * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      setPulsing((p) => ({ ...p, audio: false }));
    };
  }, [audioOn, audioSupported, audioConfig]);

  const toggleVibration = useCallback(() => {
    if (!vibrationSupported) return;
    setVibrationOn((v) => !v);
  }, [vibrationSupported]);

  const toggleAudio = useCallback(() => {
    if (!audioSupported) return;
    setAudioOn((v) => !v);
  }, [audioSupported]);

  const stopAll = useCallback(() => {
    setVibrationOn(false);
    setAudioOn(false);
  }, []);

  const value = useMemo<ActuatorsCtx>(
    () => ({
      vibrationOn,
      audioOn,
      vibrationSupported,
      audioSupported,
      vibrationConfig,
      audioConfig,
      pulsing,
      toggleVibration,
      toggleAudio,
      setVibrationConfig,
      setAudioConfig,
      stopAll,
    }),
    [
      vibrationOn,
      audioOn,
      vibrationSupported,
      audioSupported,
      vibrationConfig,
      audioConfig,
      pulsing,
      toggleVibration,
      toggleAudio,
      setVibrationConfig,
      setAudioConfig,
      stopAll,
    ],
  );

  return <ActuatorsContext.Provider value={value}>{children}</ActuatorsContext.Provider>;
}

export function useActuators(): ActuatorsCtx {
  const ctx = useContext(ActuatorsContext);
  if (!ctx) {
    return {
      vibrationOn: false,
      audioOn: false,
      vibrationSupported: false,
      audioSupported: false,
      vibrationConfig: DEFAULT_CONFIG,
      audioConfig: DEFAULT_CONFIG,
      pulsing: { vibration: false, audio: false },
      toggleVibration: () => {},
      toggleAudio: () => {},
      setVibrationConfig: () => {},
      setAudioConfig: () => {},
      stopAll: () => {},
    };
  }
  return ctx;
}
