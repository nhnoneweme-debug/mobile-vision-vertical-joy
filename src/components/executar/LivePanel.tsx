// Painel LIVE do Executando — ouvidos (transcrição contínua multilíngue e
// editável), giroscópio (leitura em tempo real, persistência agregada),
// atuadores (temporizado ou indefinido) e câmera ao vivo.
// Tudo que é persistido vira evento append-only em execution_events.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Ear,
  Maximize2,
  Mic,
  MicOff,
  Pencil,
  Radio,
  SwitchCamera,
  Vibrate,
  Volume2,
  Waves,
  WifiOff,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useTriggerEngine } from "@/hooks/useTriggerEngine";
import { listTriggers, type TriggerAction, type TriggerDefinition } from "@/lib/triggers";
import { runTriggerPrompt } from "@/lib/triggers.functions";
import { useCamera } from "@/hooks/useCamera";
import {
  useActuators,
  ACTUATOR_SOUNDS,
  INTERVAL_PRESETS,
  type ActuatorConfig,
} from "@/providers/ActuatorsProvider";



import { useWakeLockContext } from "@/providers/WakeLockProvider";
import { logExecutionEvent, type LogExecutionEventInput } from "@/lib/execution.functions";
import { StationMode } from "./StationMode";
import { NextActionsOverlay } from "./NextActionsOverlay";
import { JourneyLogSheet, type JourneyLogContext } from "./JourneyLogSheet";
import { setLiveSessionStart } from "@/hooks/useLiveSession";

const FLUSH_MS = 15_000;
const SILENCE_MS = 2_500;
const LANG_KEY = "wimi.live.lang.v1";

const LANGS = [
  { code: "pt-BR", label: "PT" },
  { code: "en-US", label: "EN" },
  { code: "es-ES", label: "ES" },
] as const;

type TranscriptBlock = {
  id: string;
  text: string;
  saved: boolean;
  revision: number;
  at: number;
};

function newId(prefix: string) {
  try {
    return crypto.randomUUID();
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function LivePanel({ missionId }: { missionId?: string | null }) {
  const [sessionId] = useState(() => newId("sess"));
  const [station, setStation] = useState(false);
  const [offline, setOffline] = useState(false);
  const [spikes, setSpikes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motionOn, setMotionOn] = useState(false);
  const [blocks, setBlocks] = useState<TranscriptBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [lang, setLang] = useState<string>("pt-BR");
  const [lastBlock, setLastBlock] = useState<{ id: string; text: string } | null>(null);
  const [lastSpike, setLastSpike] = useState<{ at: string; magnitude: number } | null>(null);
  const [sessionStartedAt] = useState(() => Date.now());
  const [journeyLog, setJourneyLog] = useState<JourneyLogContext | null>(null);

  // Um único relógio de sessão para motor, overlay e Studio.
  useEffect(() => {
    setLiveSessionStart(sessionStartedAt);
  }, [sessionStartedAt]);

  const actuators = useActuators();
  const wake = useWakeLockContext();
  const camera = useCamera();

  const bufferRef = useRef<string[]>([]);
  const blockStartRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [liveLine, setLiveLine] = useState("");

  const blocksSaved = useMemo(() => blocks.filter((b) => b.saved).length, [blocks]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && LANGS.some((l) => l.code === stored)) setLang(stored);
    } catch {
      /* storage opcional */
    }
  }, []);

  const changeLang = useCallback((code: string) => {
    setLang(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      /* storage opcional */
    }
  }, []);

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

  const persist = useCallback(async (payload: LogExecutionEventInput) => {
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
  }, []);

  const flushTranscript = useCallback(() => {
    const text = bufferRef.current.join(" ").trim();
    const startedAt = blockStartRef.current;
    bufferRef.current = [];
    blockStartRef.current = null;
    setLiveLine("");
    if (!text) return;
    const endedAt = Date.now();
    const blockId = newId("blk");
    setBlocks((prev) => [
      ...prev.slice(-40),
      { id: blockId, text, saved: false, revision: 0, at: endedAt },
    ]);
    setLastBlock({ id: blockId, text });
    void persist({
      mission_id: missionId ?? null,
      kind: "live_transcript",
      channel: "voice",
      note: text.slice(0, 4000),
      meta: {
        session_id: sessionId,
        block_id: blockId,
        revision: 0,
        lang,
        block_started_at: new Date(startedAt ?? endedAt).toISOString(),
        block_ended_at: new Date(endedAt).toISOString(),
        chars: text.length,
      },
    }).then((ok) => {
      if (ok) setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, saved: true } : b)));
    });
  }, [lang, missionId, persist, sessionId]);

  const onFinalText = useCallback(
    (text: string) => {
      if (blockStartRef.current == null) blockStartRef.current = Date.now();
      bufferRef.current.push(text);
      setLiveLine(bufferRef.current.join(" "));
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(flushTranscript, SILENCE_MS);
    },
    [flushTranscript],
  );

  const speech = useSpeechToText(onFinalText, { lang });

  const currentLine = useMemo(
    () => `${liveLine} ${speech.interim}`.trim(),
    [liveLine, speech.interim],
  );

  // Rolagem automática enquanto a fala acontece.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && editingId == null) el.scrollTop = el.scrollHeight;
  }, [blocks, currentLine, editingId]);

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

  // Edição inline: a correção humana prevalece. O modelo de eventos é
  // append-only, então gravamos um novo evento de correção referenciando o
  // bloco original (que continua no log, preservado).
  const startEdit = useCallback((b: TranscriptBlock) => {
    setEditingId(b.id);
    setDraft(b.text);
  }, []);

  const commitEdit = useCallback(() => {
    const id = editingId;
    if (!id) return;
    const next = draft.trim();
    setEditingId(null);
    const target = blocks.find((b) => b.id === id);
    if (!target || !next || next === target.text) return;
    const revision = target.revision + 1;
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, text: next, revision, saved: !b.saved ? b.saved : b.saved } : b,
      ),
    );
    if (!target.saved) return; // ainda não persistido: o texto corrigido é o que será salvo
    void persist({
      mission_id: missionId ?? null,
      kind: "live_transcript",
      channel: "manual",
      note: next.slice(0, 4000),
      meta: {
        session_id: sessionId,
        block_id: id,
        corrects_block_id: id,
        revision,
        lang,
        source: "human_edit",
        previous_text: target.text.slice(0, 2000),
        corrected_at: new Date().toISOString(),
      },
    });
  }, [blocks, draft, editingId, lang, missionId, persist, sessionId]);

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
      setLastSpike(s);
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

  // -------------------------------------------------- MOTOR DE GATILHOS
  const triggersQ = useQuery({ queryKey: ["triggers"], queryFn: listTriggers });

  const applyAction = useCallback(
    (action: TriggerAction, trigger: TriggerDefinition) => {
      if (action.stop_actuators) actuators.stopAll();
      if (action.vibrate) {
        actuators.setVibrationConfig({
          onSec: action.vibrate.onSec,
          everySec: action.vibrate.everySec ?? 30,
          mode: action.vibrate.continuous ? "continuous" : "timed",
        });
        actuators.setVibration(true);
      }
      if (action.audio_tone) {
        actuators.setAudioConfig({
          onSec: action.audio_tone.onSec,
          everySec: action.audio_tone.everySec ?? 60,
          mode: action.audio_tone.continuous ? "continuous" : "timed",
        });
        actuators.setAudio(true);
      }
      if (action.sensors) {
        const { mic, camera: cam, motion: mot } = action.sensors;
        if (mic === false && speech.listening) {
          speech.stop();
          flushTranscript();
        }
        if (mic === true && !speech.listening) speech.start();
        if (cam === false) camera.stop();
        if (cam === true && !camera.live) void camera.toggle();
        if (mot === false) setMotionOn(false);
        if (mot === true) void toggleMotion();
      }
      if (action.custom?.plan || action.custom?.instruction) {
        toast(`gatilho: ${trigger.name}`, {
          description: action.custom.plan ?? action.custom.instruction,
          duration: 8000,
        });
      }
      // ELEMENTO PROMPT — instrução em linguagem natural executada pela LLM.
      if (action.prompt?.instruction) {
        const elapsedMin = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000));
        const contextText = [
          `Sessão ao vivo há ${elapsedMin} min.`,
          bufferRef.current.length
            ? `Últimas falas transcritas:\n${bufferRef.current.slice(-8).join("\n")}`
            : "Sem transcrição recente.",
        ].join("\n");
        void runTriggerPrompt({
          data: {
            instruction: action.prompt.instruction,
            context: contextText,
            trigger_name: trigger.name,
          },
        })
          .then((res: { message: string }) => {
            toast(`WiMi · ${trigger.name}`, { description: res.message, duration: 12000 });
            void persist({
              mission_id: missionId ?? null,
              kind: "sensor_reading",
              channel: "foreground",
              note: res.message,
              meta: {
                session_id: sessionId,
                type: "trigger_prompt",
                trigger_id: trigger.id,
                instruction: action.prompt?.instruction ?? "",
              },
            });
          })
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : "A WiMi não conseguiu responder ao prompt.");
          });
      }

      if (action.journey_log_prompt) {
        setJourneyLog({
          sessionId,
          missionId: missionId ?? null,
          missionTitle: null,
          elapsedMin: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000)),
          recentTranscript: bufferRef.current.slice(-3),
          triggerName: trigger.name,
        });
      }
      toast(`gatilho: ${trigger.name}`, {
        description: action.message ?? undefined,
      });
      void persist({
        mission_id: missionId ?? null,
        kind: "sensor_reading",
        channel: "foreground",
        note: `gatilho disparado: ${trigger.name}`,
        meta: {
          session_id: sessionId,
          type: "trigger_fired",
          trigger_id: trigger.id,
          trigger_name: trigger.name,
        },
      });
    },
    [
      actuators,
      camera,
      flushTranscript,
      missionId,
      persist,
      sessionId,
      sessionStartedAt,
      speech,
      toggleMotion,
    ],
  );

  useTriggerEngine(
    (triggersQ.data ?? []) as TriggerDefinition[],
    {
      active: !offline,
      sessionStartedAt,
      lastBlock,
      lastSpike,
      beta: motionOn ? motion.live.beta : null,
      gamma: motionOn ? motion.live.gamma : null,
    },
    { applyAction },
  );

  const pauseAll = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      flushTranscript();
    }
    setMotionOn(false);
    actuators.stopAll();
    camera.stop();
  }, [actuators, camera, flushTranscript, speech]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (flushTimerRef.current) window.clearInterval(flushTimerRef.current);
    };
  }, []);

  const transcriptView = (
    <div
      ref={scrollRef}
      className="mt-3 max-h-40 min-h-[72px] space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-charcoal-950/40 px-3 py-2 text-[13px] leading-relaxed"
    >
      {blocks.length === 0 && !currentLine ? (
        <p className="text-muted-foreground">
          {speech.listening ? "ouvindo…" : "nenhuma transcrição ainda"}
        </p>
      ) : null}
      {blocks.map((b) =>
        editingId === b.id ? (
          <textarea
            key={b.id}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") setEditingId(null);
            }}
            rows={2}
            className="w-full rounded-lg border border-ember/50 bg-charcoal-900 px-2 py-1 text-[13px] text-foreground outline-none"
          />
        ) : (
          <button
            key={b.id}
            type="button"
            onClick={() => startEdit(b)}
            className="block w-full text-left text-muted-foreground active:opacity-70"
          >
            {b.text}
            {b.revision > 0 ? (
              <span className="ml-1 text-[10px] uppercase tracking-wide text-ember">corrigido</span>
            ) : null}
            {!b.saved ? <span className="ml-1 text-[10px] text-amber-400">não salvo</span> : null}
          </button>
        ),
      )}
      {currentLine ? <p className="text-foreground">{currentLine}</p> : null}
    </div>
  );

  const cameraVideo = (
    <video
      ref={camera.attach}
      muted
      playsInline
      autoPlay
      className="h-full w-full rounded-xl object-cover"
    />
  );

  if (station) {
    return (
      <>
      {journeyLog ? (
        <JourneyLogSheet context={journeyLog} onClose={() => setJourneyLog(null)} />
      ) : null}
      <StationMode
        listening={speech.listening}
        micSupported={speech.supported}
        onToggleListening={toggleListening}
        motionActive={motionOn && motion.supported}
        motionMagnitude={motion.live.magnitude}
        motionLevel={motion.live.level}
        motionDominant={motion.live.dominant}
        vibrationOn={actuators.vibrationOn}
        audioOn={actuators.audioOn}
        wakeActive={wake.active}
        transcriptLines={[...blocks.slice(-3).map((b) => b.text), currentLine].filter(Boolean)}
        blocksSaved={blocksSaved}
        spikes={spikes}
        offline={offline}
        cameraLive={camera.live}
        cameraNode={camera.live ? cameraVideo : null}
        onToggleCamera={() => void camera.toggle()}
        onFlipCamera={() => void camera.flip()}
        onExit={() => setStation(false)}
        onPauseAll={pauseAll}
        overlay={
          <NextActionsOverlay
          triggers={(triggersQ.data ?? []) as TriggerDefinition[]}
          sessionStartedAt={sessionStartedAt}
          now={{
            label: speech.listening
              ? "ouvindo e transcrevendo"
              : motionOn
                ? "lendo movimento"
                : "sessão Live parada",
            detail: `${blocksSaved} blocos`,
          }}
            big
          />
        }
      />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <NextActionsOverlay
          triggers={(triggersQ.data ?? []) as TriggerDefinition[]}
          sessionStartedAt={sessionStartedAt}
          now={{
            label: speech.listening
              ? "ouvindo e transcrevendo"
              : motionOn
                ? "lendo movimento"
                : "sessão Live parada",
            detail: `${blocksSaved} blocos`,
          }}
      />
      {journeyLog ? (
        <JourneyLogSheet context={journeyLog} onClose={() => setJourneyLog(null)} />
      ) : null}
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

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">idioma</span>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => changeLang(l.code)}
              aria-pressed={lang === l.code}
              className={`rounded-full border px-3 py-1 text-[11px] active:scale-95 ${
                lang === l.code
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-border text-muted-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {transcriptView}

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Pencil className="h-3 w-3" /> toque em qualquer linha para corrigir — o mic continua
          ouvindo. {blocksSaved} bloco(s) salvos{saving ? " · salvando…" : ""}
        </p>
      </section>

      {/* CÂMERA */}
      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Camera className="h-3.5 w-3.5" /> Câmera
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {camera.status === "unsupported"
                ? "Câmera indisponível neste navegador."
                : camera.status === "requesting"
                  ? "Pedindo permissão de câmera…"
                  : camera.status === "denied"
                    ? "Permissão negada. Libere a câmera nas configurações do site."
                    : camera.live
                      ? `Ao vivo · ${camera.facing === "user" ? "frontal" : "traseira"}`
                      : "Desligada. Nada é gravado nem enviado."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {camera.live ? (
              <button
                type="button"
                onClick={() => void camera.flip()}
                aria-label="Alternar câmera"
                className="rounded-full border border-border p-3 text-muted-foreground active:scale-95"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void camera.toggle()}
              disabled={camera.status === "unsupported"}
              aria-pressed={camera.live}
              className={`flex h-14 w-14 items-center justify-center rounded-full border disabled:opacity-40 active:scale-95 ${
                camera.live
                  ? "border-ember bg-ember/20 text-ember"
                  : "border-border bg-charcoal-800 text-muted-foreground"
              }`}
            >
              {camera.live ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {camera.error ? <p className="mt-2 text-[11px] text-destructive">{camera.error}</p> : null}

        <div className="relative mt-3 aspect-video overflow-hidden rounded-xl border border-border/60 bg-charcoal-950/60">
          {camera.live ? (
            <>
              {cameraVideo}
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-charcoal-950/80 px-2 py-1 text-[10px] uppercase tracking-wide text-ember">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ember" /> câmera ativa
              </span>
            </>
          ) : (
            <p className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
              preview desligado
            </p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Só visão ao vivo: nenhum quadro é salvo nem enviado a modelo nesta etapa.
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
              motionOn
                ? "border-ember bg-ember/15 text-ember"
                : "border-border text-muted-foreground"
            }`}
          >
            {motionOn ? "Ativo" : "Ativar"}
          </button>
        </div>

        {motionOn ? (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-950/70">
              <div
                className="h-full rounded-full bg-ember transition-[width] duration-100"
                style={{ width: `${Math.round(motion.live.level * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              atividade ao vivo · β {motion.live.beta?.toFixed(0) ?? "—"}° / γ{" "}
              {motion.live.gamma?.toFixed(0) ?? "—"}° · recebendo {motion.diag.eventsPerSec}{" "}
              eventos/s ({motion.diag.totalEvents} no total)
            </p>
            {motion.diag.blocked ? (
              <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                Nenhum evento de sensor chegou.{" "}
                {motion.inIframe
                  ? "Esta tela está dentro de um iframe de preview, que costuma bloquear acelerômetro/giroscópio. Abra o app em aba própria ou instale como PWA."
                  : "Verifique se o dispositivo tem giroscópio e se o site está em HTTPS."}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-2 text-[11px] text-muted-foreground">
          Leitura em tempo real na tela; no banco só o agregado de 30s, orientação dominante e
          picos.
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
            showSound

          />
        </div>
        <BeaconRow
          beacon={actuators.beacon}
          pulsing={actuators.beaconPulsing}
          supported={actuators.audioSupported}
          soundLabel={
            ACTUATOR_SOUNDS.find((s) => s.id === (actuators.audioConfig.sound ?? "soft"))?.label ??
            "Suave"
          }
          onChange={actuators.setBeacon}
        />
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
  showSound,
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
  showSound?: boolean;
}) {
  const continuous = config.mode === "continuous";

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
          } ${pulsing ? "animate-pulse ring-2 ring-ember" : ""}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-foreground">{label}</span>
          <span className="block text-[11px] text-muted-foreground">
            {!supported
              ? unsupportedHint
              : on
                ? continuous
                  ? "ativo · contínuo indefinido (até desligar)"
                  : `ativo · ${config.onSec}s a cada ${config.everySec}s`
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
        <>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onConfig({ ...config, mode: "timed" })}
              aria-pressed={!continuous}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] active:scale-95 ${
                !continuous
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-border text-muted-foreground"
              }`}
            >
              Temporizado
            </button>
            <button
              type="button"
              onClick={() => onConfig({ ...config, mode: "continuous" })}
              aria-pressed={continuous}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] active:scale-95 ${
                continuous
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-border text-muted-foreground"
              }`}
            >
              Contínuo (indefinido)
            </button>
          </div>

          {showSound ? (
            <div className="mt-3">
              <p className="text-[11px] text-muted-foreground">Som</p>
              <div className="mt-1.5 flex gap-2">
                {ACTUATOR_SOUNDS.map((s) => {
                  const active = (config.sound ?? "soft") === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.hint}
                      onClick={() => onConfig({ ...config, sound: s.id })}
                      aria-pressed={active}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] active:scale-95 ${
                        active
                          ? "border-ember bg-ember/15 text-ember"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {continuous ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sem duração definida: o padrão se repete a cada ~2,5s até você desligar.
            </p>
          ) : (
            <>
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
              {showSound ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {INTERVAL_PRESETS.map((sec: number) => {
                    const active = config.everySec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onConfig({ ...config, everySec: sec })}
                        className={`min-w-0 rounded-lg border px-1 py-1.5 text-[11px] active:scale-95 ${
                          active
                            ? "border-ember bg-ember/15 text-ember"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}min`}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

