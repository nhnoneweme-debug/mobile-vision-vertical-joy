import { toast } from "sonner";
import { langBase, NO_VOICE_HINT, ensureVoices } from "@/lib/tts-voices";
import { speakUnified, stopSpeaking } from "@/lib/tts-engine";
// Atuadores persistentes da WiMi (vibração + emissão de áudio + voz).
//
// Vivem acima das rotas (montados no MobileShell) pra que o padrão continue
// rodando enquanto o usuário navega pelo app — só para quando ele desliga.
// Config (N segundos a cada M segundos) persiste em localStorage.
//
// EMISSÃO DE ÁUDIO é UM ÚNICO BLOCO: um agendador só. Não existe mais um
// "beacon" separado disparando o mesmo timbre em paralelo (isso dobrava o som).
// O sinal periódico de presença é simplesmente a emissão de áudio no modo
// temporizado com um dos intervalos预 predefinidos.

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

/** Intervalos rápidos para o sinal periódico de presença. */
export const INTERVAL_PRESETS = [30, 60, 120, 300];

/** Unidade do intervalo do beacon de presença. */
export type BeaconUnit = "s" | "min";

export function beaconIntervalSec(b: { value: number; unit: BeaconUnit }): number {
  const raw = b.unit === "min" ? b.value * 60 : b.value;
  return Math.min(3600, Math.max(5, Math.round(raw)));
}

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
  /**
   * BEACON DE PRESENÇA — camada de timer DENTRO do bloco de áudio.
   * Quando ligado, o agendador ÚNICO passa a usar este intervalo (número +
   * unidade). Não nasce um segundo emissor: o beacon É a emissão periódica.
   */
  beacon?: { on: boolean; value: number; unit: BeaconUnit };
  /** timbre usado pelo atuador de áudio (ignorado na vibração) */
  sound?: ActuatorSound;
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
  setVibration: (on: boolean) => void;
  setAudio: (on: boolean) => void;
  setVibrationConfig: (c: ActuatorConfig) => void;
  setAudioConfig: (c: ActuatorConfig) => void;
  /** voz das manifestações (a WiMi fala o que se manifesta) */
  speechOn: boolean;
  speechSupported: boolean;
  toggleSpeech: () => void;
  speaking: boolean;
  /** fala um texto se a voz estiver ligada; no-op caso contrário */
  speak: (text: string, opts?: { onEnd?: () => void; lang?: string }) => void;
  /** toque curto de turno (turn-taking) — independe dos loops de atuador */
  chime: (sound?: ActuatorSound) => void;
  stopAll: () => void;
};

const STORAGE_KEY = "wimi.actuators.v1";

const DEFAULT_CONFIG: ActuatorConfig = { onSec: 1, everySec: 30, mode: "timed", sound: "soft" };

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
  const sound: ActuatorSound = c?.sound === "bell" || c?.sound === "tick" ? c.sound : "soft";
  const rawBeacon = c?.beacon;
  const unit: BeaconUnit = rawBeacon?.unit === "min" ? "min" : "s";
  const value = Math.min(
    999,
    Math.max(1, Math.round(Number(rawBeacon?.value ?? (unit === "min" ? 2 : 60)))),
  );
  const beacon = { on: !!rawBeacon?.on, value, unit };
  return { onSec, everySec: Math.max(everySec, onSec + 1), mode, sound, beacon };
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
    sound: "soft",
  });
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const [pulsing, setPulsing] = useState({ vibration: false, audio: false });
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechOn, setSpeechOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const noVoiceWarnedRef = useRef<Set<string>>(new Set());

  const audioCtxRef = useRef<AudioContext | null>(null);
  // Timer único do áudio + trava anti-sobreposição (ver agendador abaixo).
  const audioTimerRef = useRef<number | null>(null);
  const audioStartedRef = useRef(false);
  const lastAudioFireRef = useRef(0);

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
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    void ensureVoices();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        vibration?: Partial<ActuatorConfig>;
        audio?: Partial<ActuatorConfig>;
        speech?: boolean;
      };
      setVibrationConfigState(clampConfig(parsed.vibration));
      setAudioConfigState(clampConfig(parsed.audio));
      if (typeof parsed.speech === "boolean") setSpeechOn(parsed.speech);
    } catch {
      /* config opcional */
    }
  }, []);

  const persist = useCallback((vib: ActuatorConfig, aud: ActuatorConfig, speech: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ vibration: vib, audio: aud, speech }));
    } catch {
      /* storage indisponível */
    }
  }, []);

  const setVibrationConfig = useCallback(
    (c: ActuatorConfig) => {
      const next = clampConfig(c);
      setVibrationConfigState(next);
      persist(next, audioConfig, speechOn);
    },
    [audioConfig, persist, speechOn],
  );

  const setAudioConfig = useCallback(
    (c: ActuatorConfig) => {
      const next = clampConfig(c);
      setAudioConfigState(next);
      persist(vibrationConfig, next, speechOn);
    },
    [persist, speechOn, vibrationConfig],
  );

  const toggleSpeech = useCallback(() => {
    setSpeechOn((prev) => {
      const next = !prev;
      persist(vibrationConfig, audioConfig, next);
      if (!next) {
        stopSpeaking();
        setSpeaking(false);
      }
      return next;
    });
  }, [audioConfig, persist, vibrationConfig]);

  // Ponto de entrada ÚNICO de fala: servidor → voz do aparelho → texto.
  const speak = useCallback(
    (text: string, opts?: { onEnd?: () => void; lang?: string }) => {
      if (!speechOn) {
        opts?.onEnd?.();
        return;
      }
      void speakUnified(text, {
        lang: opts?.lang ?? "pt-BR",
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          opts?.onEnd?.();
        },
      }).then((outcome) => {
        if (outcome === "no-voice") {
          setSpeaking(false);
          opts?.onEnd?.();
          const base = langBase(opts?.lang ?? "pt-BR");
          if (!noVoiceWarnedRef.current.has(base)) {
            noVoiceWarnedRef.current.add(base);
            toast.warning(NO_VOICE_HINT[base]);
          }
        } else if (outcome === "text-only" || outcome === "empty") {
          setSpeaking(false);
        }
      });
    },
    [speechOn],
  );

  /**
   * Toque curto de turno: usado pelo Live Dinâmico para sinalizar "sua vez de
   * falar" / "minha vez". Não liga o loop de atuadores.
   */
  const chime = useCallback(
    (sound: ActuatorSound = "tick") => {
      if (!audioSupported) return;
      try {
        if (!audioCtxRef.current) {
          const Ctor =
            (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          audioCtxRef.current = new Ctor();
        }
        const ctx = audioCtxRef.current;
        void ctx.resume().catch(() => {});
        playSound(ctx, sound);
      } catch {
        /* áudio bloqueado sem gesto do usuário */
      }
    },
    [audioSupported],
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

  // Primitivas derivadas: o efeito depende delas, não do objeto de config
  // inteiro — assim editar um campo irrelevante não reinicia o agendador.
  const beaconOn = audioConfig.beacon?.on === true;
  const beaconSec = beaconIntervalSec(audioConfig.beacon ?? { value: 60, unit: "s" });
  const audioMode = audioConfig.mode;
  const audioSound = audioConfig.sound ?? "soft";

  // FATIA 3.5.2 — NOVO CONTRATO DO BLOCO DE ÁUDIO.
  //
  // "Emissão de áudio" ON, sozinha, é ARMADA E SILENCIOSA: nenhuma emissão
  // periódica automática. Modo (temporizado/contínuo), duração e timbre são
  // apenas CONFIGURAÇÃO do padrão que toca quando algo dispara — um gatilho,
  // uma manifestação, ou o Beacon.
  //
  // O ÚNICO emissor autônomo e periódico é o BEACON DE PRESENÇA, com seu
  // próprio toggle e seu próprio intervalo. Beacon OFF = silêncio total.
  useEffect(() => {
    if (!audioOn || !audioSupported || !beaconOn) {
      audioStartedRef.current = false;
      if (audioTimerRef.current) {
        window.clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      setPulsing((p) => (p.audio ? { ...p, audio: false } : p));
      return;
    }
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

    const sound = audioSound;

    const fire = () => {
      if (cancelled) return;
      // Trava anti-sobreposição: nenhuma fonte pode empilhar timbres.
      const now = Date.now();
      if (now - lastAudioFireRef.current < 400) return;
      lastAudioFireRef.current = now;
      const ctx = getCtx();
      if (!ctx) return;
      void ctx.resume().catch(() => {});
      const dur = playSound(ctx, sound);
      // No modo contínuo o "padrão" é repetido em rajada curta dentro do
      // próprio pulso do beacon; no temporizado é uma emissão única.
      if (audioMode === "continuous") {
        window.setTimeout(() => {
          if (!cancelled) playSound(ctx, sound);
        }, CONTINUOUS_PATTERN_MS);
      }
      setPulsing((p) => ({ ...p, audio: true }));
      window.setTimeout(() => {
        if (!cancelled) setPulsing((p) => ({ ...p, audio: false }));
      }, dur * 1000);
    };

    const periodMs = Math.max(1000, beaconSec * 1000);

    // Um só timer vivo: derruba qualquer resíduo antes de criar o novo.
    if (audioTimerRef.current) {
      window.clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (!audioStartedRef.current) {
      audioStartedRef.current = true;
      fire();
    }
    audioTimerRef.current = window.setInterval(fire, periodMs);

    return () => {
      cancelled = true;
      if (audioTimerRef.current) {
        window.clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      setPulsing((p) => ({ ...p, audio: false }));
    };
  }, [audioOn, audioSupported, beaconOn, beaconSec, audioMode, audioSound]);

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
    stopSpeaking();
    setSpeaking(false);
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
      speechOn,
      speechSupported,
      toggleSpeech,
      speaking,
      speak,
      chime,
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
      speechOn,
      speechSupported,
      toggleSpeech,
      speaking,
      speak,
      chime,
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
      speechOn: false,
      speechSupported: false,
      toggleSpeech: () => {},
      speaking: false,
      speak: () => {},
      chime: () => {},
      stopAll: () => {},
    };
  }
  return ctx;
}
