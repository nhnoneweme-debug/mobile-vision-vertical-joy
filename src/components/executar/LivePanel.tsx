// Painel LIVE do Executando — ouvidos (transcrição contínua), giroscópio
// agregado e atuadores (vibração + áudio) com padrão temporal persistente.
// Tudo que é persistido vira evento append-only em execution_events.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ear,
  Maximize2,
  Mic,
  MicOff,
  Vibrate,
  Volume2,
  Waves,
  WifiOff,
} from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useDeviceMotionAggregator, type MotionAggregate } from "@/hooks/useDeviceMotion";
import { useActuators, type ActuatorConfig } from "@/providers/ActuatorsProvider";
import { useWakeLockContext } from "@/providers/WakeLockProvider";
import { logExecutionEvent } from "@/lib/execution.functions";
import { StationMode } from "./StationMode";

const FLUSH_MS = 15_000;
const SILENCE_MS = 2_500;

function newSessionId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function LivePanel({ missionId }: { missionId?: string | null }) {
  const [sessionId] = useState(() => newSessionId());
  const [station, setStation] = useState(false);
  const [offline, setOffline] = useState(false);
  const [blocksSaved, setBlocksSaved] = useState(0);
  const [spikes, setSpikes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motionOn, setMotionOn] = useState(false);
  const [lastBlock, setLastBlock] = useState<string | null>(null);

  const actuators = useActuators();
  const wake = useWakeLockContext();

  const bufferRef = useRef<string[]>([]);
  const blockStartRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const persist = useCallback(
    async (payload: Parameters<typeof logExecutionEvent>[0]["data"]) => {
      setSaving(true);
      try {
        await logExecutionEvent({ data: payload });
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao salvar evento.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const flushTranscript = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    const startedAt = blockStartRef.current;
    bufferRef.current = [];
    blockStartRef.current = null;
    if (!text) return;
    const endedAt = Date.now();
    setLastBlock(text);
    void persist({
      mission_id: missionId ?? null,
      kind: "live_transcript",
      channel: "voice",
      note: text.slice(0, 4000),
      meta: {
        session_id: sessionId,
        block_started_at: new Date(startedAt ?? endedAt).toISOString(),
        block_ended_at: new Date(endedAt).toISOString(),
        chars: text.length,
      },
    }).then((ok) => {
      if (ok) setBlocksSaved((n) => n + 1);
    });
  }, [missionId, persist, sessionId]);

  const onFinalText = useCallback(
    (text: string) => {
      if (blockStartRef.current == null) blockStartRef.current = Date.now();
      bufferRef.current.push(text);
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(flushTranscript, SILENCE_MS);
    },
    [flushTranscript],
  );

  const speech = useSpeechToText(onFinalText);

  // Flush periódico (~15s) enquanto estiver ouvindo.
  useEffect(() => {
    if (!speech.listening) return;
    flushTimerRef.current = window.setInterval(flushTranscript, FLUSH_MS);
    return () => {
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [speech.listening, flushTranscript]);

  const toggleListening = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      flushTranscript();
    } else {
      speech.start();
    }
  }, [flushTranscript, speech]);

  const onAggregate = useCallback(
    (a: MotionAggregate) => {
      void persist({
        mission_id: missionId ?? null,
        kind: "sensor_reading",
        channel: "foreground",
        meta: {
          session_id: sessionId,
          type: "orientation_aggregate",
          started_at: a.startedAt,
          ended_at: a.endedAt,
          samples: a.samples,
          alpha: a.alpha,
          beta: a.beta,
          gamma: a.gamma,
          dominant: a.dominant,
          peak_accel: a.peakAccel,
          avg_accel: a.avgAccel,
        },
      });
    },
    [missionId, persist, sessionId],
  );

  const onSpike = useCallback(
    (s: { at: string; magnitude: number }) => {
      setSpikes((n) => n + 1);
      void persist({
        mission_id: missionId ?? null,
        kind: "sensor_reading",
        channel: "foreground",
        note: "movimento brusco detectado",
        meta: {
          session_id: sessionId,
          type: "motion_spike",
          at: s.at,
          magnitude: s.magnitude,
        },
      });
    },
    [missionId, persist, sessionId],
  );

  const motion = useDeviceMotionAggregator({
    enabled: motionOn && !offline,
    onAggregate,
    onSpike,
  });

  const toggleMotion = useCallback(async () => {
    if (motionOn) {
      setMotionOn(false);
      return;
    }
    const ok = await motion.requestPermission();
    if (ok || motion.permission === "granted" || motion.permission === "unknown") setMotionOn(true);
  }, [motion, motionOn]);

  const pauseAll = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      flushTranscript();
    }
    setMotionOn(false);
    actuators.stopAll();
  }, [actuators, flushTranscript, speech]);

  const preview = useMemo(
    () => speech.preview || lastBlock || "",
    [speech.preview, lastBlock],
  );

  // Parada real ao desmontar: nada continua capturando em segundo plano.
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    };
  }, []);

  if (station) {
    return (
      <StationMode
        listening={speech.listening}
        micSupported={speech.supported}
        onToggleListening={toggleListening}
        motionActive={motionOn && motion.supported}
        motionMagnitude={motion.live.magnitude}
        motionDominant={motion.live.dominant}
        vibrationOn={actuators.vibrationOn}
        audioOn={actuators.audioOn}
        wakeActive={wake.active}
        transcriptPreview={preview}
        blocksSaved={blocksSaved}
        spikes={spikes}
        offline={offline}
        onExit={() => setStation(false)}
        onPauseAll={pauseAll}
      />
    );
  }

  return (
    <div className="space-y-4">
      {offline ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
          <WifiOff className="h-4 w-4 shrink-0" /> Você está offline. A captura fica pausada — nada
          é salvo até a conexão voltar.
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      {/* OUVIDOS */}
      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Ear className="h-3.5 w-3.5" /> Ouvidos
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {!speech.supported
                ? "Transcrição não suportada neste navegador."
                : speech.listening
                  ? "Microfone ativo — transcrevendo e salvando em blocos."
                  : "Microfone desligado."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            disabled={!speech.supported || offline}
            aria-pressed={speech.listening}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 active:scale-95 ${
              speech.listening
                ? "animate-pulse border-ember bg-ember/20 text-ember"
                : "border-border bg-charcoal-800 text-muted-foreground"
            }`}
          >
            {speech.listening ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>
        </div>

        <div className="mt-3 min-h-[42px] rounded-xl border border-border/60 bg-charcoal-950/40 px-3 py-2 text-[13px] text-foreground">
          {preview ? (
            <span className="line-clamp-2">{preview}</span>
          ) : (
            <span className="text-muted-foreground">
              {speech.listening ? "ouvindo…" : "nenhuma transcrição ainda"}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {blocksSaved} bloco(s) salvos nesta sessão{saving ? " · salvando…" : ""}
        </p>
      </section>

      {/* GIROSCÓPIO */}
      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Waves className="h-3.5 w-3.5" /> Movimento
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {!motion.supported
                ? "Sensores de movimento indisponíveis neste dispositivo."
                : motion.permission === "denied"
                  ? "Permissão de sensores negada."
                  : motionOn
                    ? `${motion.live.dominant} · ${motion.live.magnitude.toFixed(1)} m/s² · ${spikes} pico(s)`
                    : "Leitura desligada."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleMotion()}
            disabled={!motion.supported || offline}
            aria-pressed={motionOn}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs disabled:opacity-40 active:scale-95 ${
              motionOn ? "border-ember bg-ember/15 text-ember" : "border-border text-muted-foreground"
            }`}
          >
            {motionOn ? "Ativo" : "Ativar"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Agregado a cada 30s. Nada de 60Hz cru no banco — só média/orientação dominante e picos.
        </p>
      </section>

      {/* ATUADORES */}
      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <h3 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Atuadores
        </h3>
        <div className="mt-3 space-y-3">
          <ActuatorRow
            icon={<Vibrate className="h-5 w-5" />}
            label="Vibração"
            on={actuators.vibrationOn}
            pulsing={actuators.pulsing.vibration}
            supported={actuators.vibrationSupported}
            unsupportedHint="Seu navegador (iOS/Safari) não expõe vibração. Controle desativado."
            config={actuators.vibrationConfig}
            onToggle={actuators.toggleVibration}
            onConfig={actuators.setVibrationConfig}
          />
          <ActuatorRow
            icon={<Volume2 className="h-5 w-5" />}
            label="Emissão de áudio"
            on={actuators.audioOn}
            pulsing={actuators.pulsing.audio}
            supported={actuators.audioSupported}
            unsupportedHint="Web Audio indisponível neste navegador."
            config={actuators.audioConfig}
            onToggle={actuators.toggleAudio}
            onConfig={actuators.setAudioConfig}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Os padrões continuam rodando enquanto você navega no app, até desligar aqui.
        </p>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStation(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ember/40 bg-ember/10 py-3 text-sm text-ember active:scale-95"
        >
          <Maximize2 className="h-4 w-4" /> Modo estação
        </button>
        <button
          type="button"
          onClick={pauseAll}
          className="rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground active:scale-95"
        >
          Pausar tudo
        </button>
      </div>
      {!wake.active && wake.supported ? (
        <button
          type="button"
          onClick={() => void wake.toggle()}
          className="w-full rounded-xl border border-border py-2 text-[12px] text-muted-foreground active:scale-95"
        >
          Manter a tela ligada (wake lock)
        </button>
      ) : null}
    </div>
  );
}

function ActuatorRow({
  icon,
  label,
  on,
  pulsing,
  supported,
  unsupportedHint,
  config,
  onToggle,
  onConfig,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  pulsing: boolean;
  supported: boolean;
  unsupportedHint: string;
  config: ActuatorConfig;
  onToggle: () => void;
  onConfig: (c: ActuatorConfig) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        on ? "border-ember/50 bg-ember/5" : "border-border bg-charcoal-950/30"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!supported}
        aria-pressed={on}
        className="flex w-full items-center gap-3 text-left disabled:opacity-40 active:scale-[0.99]"
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            on ? "bg-ember/20 text-ember" : "bg-charcoal-800 text-muted-foreground"
          } ${pulsing ? "animate-ping-slow ring-2 ring-ember" : ""}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-foreground">{label}</span>
          <span className="block text-[11px] text-muted-foreground">
            {!supported
              ? unsupportedHint
              : on
                ? `ativo · ${config.onSec}s a cada ${config.everySec}s`
                : "desligado"}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
            on ? "bg-ember/20 text-ember" : "bg-charcoal-800 text-muted-foreground"
          }`}
        >
          {on ? "on" : "off"}
        </span>
      </button>

      {supported ? (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-[11px] text-muted-foreground">
            dura (s)
            <input
              type="number"
              min={1}
              max={10}
              value={config.onSec}
              onChange={(e) => onConfig({ ...config, onSec: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-charcoal-950/60 px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-[11px] text-muted-foreground">
            a cada (s)
            <input
              type="number"
              min={5}
              max={3600}
              value={config.everySec}
              onChange={(e) => onConfig({ ...config, everySec: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-charcoal-950/60 px-2 py-1 text-sm text-foreground"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
