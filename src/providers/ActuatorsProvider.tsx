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

/** Timbres sintetizados via Web Audio para o atuador de áudio. */
export type ActuatorSound = "soft" | "bell" | "tick";

export const ACTUATOR_SOUNDS: { id: ActuatorSound; label: string; hint: string }[] = [
  { id: "soft", label: "Suave", hint: "duas notas em quinta, ~400ms" },
  { id: "bell", label: "Sino", hint: "harmônicos com decay, ~600ms" },
  { id: "tick", label: "Tique", hint: "clique discreto, ~80ms" },
];

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
  /** timbre usado pelo atuador de áudio (ignorado na vibração) */
  sound?: ActuatorSound;
};

/** Sinal sonoro periódico de presença ("estou aqui, ativa"). */
export type BeaconConfig = {
  enabled: boolean;
  /** intervalo entre bipes, em segundos */
  everySec: number;
};

export const BEACON_PRESETS = [30, 60, 120, 300];

type ActuatorsCtx = {
  vibrationOn: boolean;
  audioOn: boolean;
  vibrationSupported: boolean;
  audioSupported: boolean;
  vibrationConfig: ActuatorConfig;
  audioConfig: ActuatorConfig;
  beacon: BeaconConfig;
  beaconPulsing: boolean;
  setBeacon: (c: BeaconConfig) => void;
  pulsing: { vibration: boolean; audio: boolean };
  toggleVibration: () => void;
  toggleAudio: () => void;
  setVibration: (on: boolean) => void;
  setAudio: (on: boolean) => void;
  setVibrationConfig: (c: ActuatorConfig) => void;
  setAudioConfig: (c: ActuatorConfig) => void;
  stopAll: () => void;

};

const STORAGE_KEY = "wimi.actuators.v1";

const DEFAULT_CONFIG: ActuatorConfig = { onSec: 1, everySec: 30, mode: "timed", sound: "soft" };

const DEFAULT_BEACON: BeaconConfig = { enabled: false, everySec: 60 };


/** intervalo de repetição do padrão sonoro no modo contínuo (ms) */
const CONTINUOUS_PATTERN_MS = 2500;

const ActuatorsContext = createContext<ActuatorsCtx | null>(null);

function clampConfig(c: Partial<ActuatorConfig> | undefined): ActuatorConfig {
  const onSec = Math.min(10, Math.max(1, Math.round(Number(c?.onSec ?? DEFAULT_CONFIG.onSec))));
  const everySec = Math.min(
    3600,
    Math.max(5, Math.round(Number(c?.everySec ?? DEFAULT_CONFIG.everySec))),
  );
  const mode: ActuatorMode = c?.mode === "continuous" ? "continuous" : "timed";
  const sound: ActuatorSound =
    c?.sound === "bell" || c?.sound === "tick" ? c.sound : "soft";
  return { onSec, everySec: Math.max(everySec, onSec + 1), mode, sound };
}

/**
 * Toca um timbre curto e agradável. Sempre com envelope (attack/release) para
 * evitar clique de corte seco. Retorna a duração aproximada, em segundos.
 */
function playSound(ctx: AudioContext, sound: ActuatorSound): number {
  const t0 = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);

  const tone = (
    freq: number,
    start: number,
    dur: number,
    peak: number,
    type: OscillatorType = "sine",
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.05, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  };

  if (sound === "tick") {
    tone(1400, t0, 0.05, 0.07, "triangle");
    tone(2600, t0, 0.03, 0.03, "sine");
    return 0.08;
  }

  if (sound === "bell") {
    tone(880, t0, 0.6, 0.09);
    tone(1760, t0, 0.35, 0.03);
    tone(2640, t0, 0.18, 0.015);
    return 0.6;
  }

  // "soft": duas notas em quinta (528Hz → 792Hz)
  tone(528, t0, 0.24, 0.08);
  tone(792, t0 + 0.18, 0.24, 0.07);
  return 0.42;
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

  // Loop do áudio (timbre curto e agradável via Web Audio).
  // Contínuo = atuador armado indefinidamente, repetindo o padrão — nunca uma
  // senoide infinita (que soava como tom de discar).
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

    const sound = audioConfig.sound ?? "soft";

    const fire = () => {
      if (cancelled) return;
      const ctx = getCtx();
      if (!ctx) return;
      void ctx.resume().catch(() => {});
      const dur = playSound(ctx, sound);
      setPulsing((p) => ({ ...p, audio: true }));
      window.setTimeout(() => {
        if (!cancelled) setPulsing((p) => ({ ...p, audio: false }));
      }, dur * 1000);
    };

    const periodMs =
      audioConfig.mode === "continuous"
        ? CONTINUOUS_PATTERN_MS
        : Math.max(1000, audioConfig.everySec * 1000);

    fire();
    const id = window.setInterval(fire, periodMs);

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

  const setVibration = useCallback(
    (on: boolean) => {
      if (!vibrationSupported) return;
      setVibrationOn(on);
    },
    [vibrationSupported],
  );

  const setAudio = useCallback(
    (on: boolean) => {
      if (!audioSupported) return;
      setAudioOn(on);
    },
    [audioSupported],
  );

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
      setVibration,
      setAudio,
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
      setVibration,
      setAudio,
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
      setVibration: () => {},
      setAudio: () => {},
      setVibrationConfig: () => {},
      setAudioConfig: () => {},
      stopAll: () => {},
    };
  }
  return ctx;
}
