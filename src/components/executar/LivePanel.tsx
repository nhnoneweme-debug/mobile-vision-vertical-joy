// Painel LIVE do Executando — ouvidos (transcrição contínua multilíngue e
// editável), atuadores (vibração + emissão de áudio em bloco único, com voz
// das manifestações) e câmera ao vivo. Sem sensores de movimento.
// Tudo que é persistido vira evento append-only em execution_events.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Ear,
  Maximize2,
  Mic,
  MessagesSquare,
  MicOff,

  Pencil,
  Radio,
  SwitchCamera,
  Vibrate,
  Volume2,
  WifiOff,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useTriggerEngine } from "@/hooks/useTriggerEngine";
import {
  armedCommands,
  listTriggers,
  recordFiring,
  type LiveEventName,
  type TriggerAction,
  type TriggerDefinition,
} from "@/lib/triggers";

import { runTriggerPrompt } from "@/lib/triggers.functions";

import { useCamera } from "@/hooks/useCamera";
import {
  useActuators,
  ACTUATOR_SOUNDS,
  INTERVAL_PRESETS,
  beaconIntervalSec,
  type BeaconUnit,
  type ActuatorConfig,
} from "@/providers/ActuatorsProvider";

import { useWakeLockContext } from "@/providers/WakeLockProvider";
import { logExecutionEvent, type LogExecutionEventInput } from "@/lib/execution.functions";
import { StationMode } from "./StationMode";
import { NextActionsOverlay } from "./NextActionsOverlay";
import { JourneyLogSheet, type JourneyLogContext } from "./JourneyLogSheet";
import { setLiveSessionStart } from "@/hooks/useLiveSession";
import { LiveClock } from "./LiveClock";
import { ExecutionLogCard } from "./ExecutionLogCard";
import { SessionTalkSheet, type SessionTalkContext } from "./SessionTalkSheet";
import { liveHandoverReply, liveUnderstanding } from "@/lib/live-dialog.functions";
import {
  detectModeCommand,
  detectSessionTalk,
  hasCallCode,
  loadAddressMode,
  loadCallCodes,
  saveAddressMode,
  saveCallCodes,
  stripCallCode,
  type AddressMode,
} from "@/lib/live-dialog";

const FLUSH_MS = 15_000;
const SILENCE_MS = 2_500;
const LANG_KEY = "wimi.live.lang.v1";
/** fim de turno: silêncio curto que passa a palavra à WiMi */
const HANDOVER_MS = 2_000;


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

export function LivePanel({
  missionId,
  onOpenCommands,
  header,
}: {
  missionId?: string | null;
  /** Abre a área de Comandos (aba Gatilhos) a partir do contador do overlay. */
  onOpenCommands?: () => void;
  /** Conteúdo da jornada renderizado logo abaixo do relógio. */
  header?: React.ReactNode;
}) {
  const [sessionId] = useState(() => newId("sess"));
  const [station, setStation] = useState(false);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<TranscriptBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [lang, setLang] = useState<string>("pt-BR");
  const [lastBlock, setLastBlock] = useState<{ id: string; text: string } | null>(null);
  const [sessionStartedAt] = useState(() => Date.now());
  const [journeyLog, setJourneyLog] = useState<JourneyLogContext | null>(null);

  // LIVE DINÂMICO — análise contínua, endereçamento e handover por silêncio.
  const [dynamic, setDynamic] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>("addressed");
  const [callCodes, setCallCodes] = useState<string[]>([]);
  const [codeDraft, setCodeDraft] = useState("");
  const [understanding, setUnderstanding] = useState<string | null>(null);
  const [handoverState, setHandoverState] = useState<string | null>(null);
  const [sessionTalk, setSessionTalk] = useState<SessionTalkContext | null>(null);

  const addressModeRef = useRef<AddressMode>("addressed");
  const callCodesRef = useRef<string[]>([]);
  const understandingRef = useRef<string | null>(null);
  const sessionTalkRef = useRef(false);
  const respondingRef = useRef(false);
  /** fala acumulada do turno atual (esvaziada a cada handover) */
  const turnRef = useRef<string[]>([]);
  addressModeRef.current = addressMode;
  callCodesRef.current = callCodes;
  sessionTalkRef.current = sessionTalk != null;

  // Preferências de endereçamento persistem por ambiente.
  useEffect(() => {
    setAddressMode(loadAddressMode());
    setCallCodes(loadCallCodes());
  }, []);

  const changeAddressMode = useCallback((mode: AddressMode) => {
    setAddressMode(mode);
    saveAddressMode(mode);
  }, []);

  const changeCodes = useCallback((codes: string[]) => {
    const clean = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
    setCallCodes(clean);
    saveCallCodes(clean);
  }, []);


  const [liveEvent, setLiveEvent] = useState<{
    name: LiveEventName;
    ref: string;
    meta?: Record<string, unknown>;
  } | null>(null);

  const emitEvent = useCallback((name: LiveEventName, meta?: Record<string, unknown>) => {
    setLiveEvent({
      name,
      ref: `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      meta,
    });
  }, []);

  // Um único relógio de sessão para motor, overlay e Studio.
  useEffect(() => {
    setLiveSessionStart(sessionStartedAt);
  }, [sessionStartedAt]);

  // O início da sessão é um evento de primeira classe (gatilhos podem escutar).
  useEffect(() => {
    emitEvent("session_start", { session_started_at: new Date(sessionStartedAt).toISOString() });
  }, [emitEvent, sessionStartedAt]);

  const actuators = useActuators();
  const wake = useWakeLockContext();
  const camera = useCamera();

  const bufferRef = useRef<string[]>([]);
  const blockStartRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSpeechAtRef = useRef<number>(Date.now());
  const [liveLine, setLiveLine] = useState("");

  const blocksSaved = useMemo(() => blocks.filter((b) => b.saved).length, [blocks]);

  // Espelho das falas recentes para as manifestações contextuais.
  const blocksRef = useRef<string[]>([]);
  blocksRef.current = blocks.map((b) => b.text);

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
    emitEvent("transcript_block", { block_id: blockId, chars: text.length });
  }, [emitEvent, lang, missionId, persist, sessionId]);

  const onFinalText = useCallback(
    (text: string) => {
      if (blockStartRef.current == null) blockStartRef.current = Date.now();
      lastSpeechAtRef.current = Date.now();
      bufferRef.current.push(text);
      turnRef.current.push(text);
      setLiveLine(bufferRef.current.join(" "));
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(flushTranscript, SILENCE_MS);
    },
    [flushTranscript],
  );

  const speech = useSpeechToText(onFinalText, { lang });
  const speechRef = useRef(speech);
  speechRef.current = speech;

  // -------------------------------------------------- CONTEÚDO DA SESSÃO
  const sessionContent = useCallback(
    () =>
      [
        ...blocksRef.current,
        turnRef.current.join(" "),
        speechRef.current.interim,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(-12000),
    [],
  );

  const openSessionTalk = useCallback(
    (initialQuestion?: string) => {
      setSessionTalk({
        sessionId,
        missionId: missionId ?? null,
        content: sessionContent(),
        initialQuestion: initialQuestion ?? null,
      });
    },
    [missionId, sessionContent, sessionId],
  );

  // ---------------------------------- (1) ANÁLISE CONTÍNUA (pré-aquecimento)
  //
  // A cada 2 blocos fechados, uma chamada leve atualiza o "entendimento da
  // conversa". Quando o handover chega, o contexto JÁ está montado.
  useEffect(() => {
    if (!dynamic || blocks.length === 0 || blocks.length % 2 !== 0) return;
    const transcript = blocksRef.current.slice(-10).join("\n").slice(-6000);
    if (!transcript.trim()) return;
    let alive = true;
    void liveUnderstanding({ data: { transcript } })
      .then((r: { understanding: string }) => {
        if (alive) {
          understandingRef.current = r.understanding;
          setUnderstanding(r.understanding);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [blocks.length, dynamic]);

  // -------------------------------- (2) CÓDIGOS DE COMUNICAÇÃO (no interim)
  //
  // Modo livre / só quando eu chamar / conversar sobre a sessão são detectados
  // continuamente no texto parcial, sem esperar o fim do bloco.
  const handleCodes = useCallback(
    (text: string) => {
      const tail = text.slice(-160);
      if (!tail.trim()) return;
      const code = hasCallCode(tail, callCodesRef.current);
      if (!code) return;
      const mode = detectModeCommand(tail);
      if (mode && mode !== addressModeRef.current) {
        changeAddressMode(mode);
        actuators.chime("soft");
        actuators.speak(
          mode === "free" ? "Modo livre: respondo a tudo." : "Ok, só quando você me chamar.",
        );
        turnRef.current = [];
        return;
      }
      if (detectSessionTalk(tail) && !sessionTalkRef.current) {
        turnRef.current = [];
        openSessionTalk("Do que a gente falou até agora? Faça um resumo do que foi dito.");
      }
    },
    // changeAddressMode é estável (definido abaixo com useCallback sem deps)
    [actuators, changeAddressMode, openSessionTalk],

  );

  // -------------------------------------- (3) HANDOVER (~2s de silêncio)
  const handleHandover = useCallback(
    async (turn: string) => {
      const codes = callCodesRef.current;
      const code = hasCallCode(turn, codes);
      const free = addressModeRef.current === "free";

      // NÃO ENDEREÇADA: só escuta e registra. Nunca interrompe.
      if (!code && !free) {
        setHandoverState("fala sem código de chamada — só registrei.");
        void persist({
          mission_id: missionId ?? null,
          kind: "sensor_reading",
          channel: "foreground",
          note: turn.slice(0, 2000),
          meta: {
            session_id: sessionId,
            type: "handover_skipped",
            reason: "sem_codigo_de_chamada",
          },
        });
        return;
      }

      respondingRef.current = true;
      setHandoverState("preparando resposta…");
      const wasListening = speechRef.current.listening;
      const question = stripCallCode(turn, codes) || turn;
      const release = () => {
        respondingRef.current = false;
      };
      try {
        const res = await liveHandoverReply({
          data: {
            turn: question.slice(0, 4000),
            understanding: understandingRef.current || undefined,
            recent: blocksRef.current.slice(-6).join("\n").slice(-4000) || undefined,
            addressed_by_code: !!code,
          },
        });
        // (c) heurística de ambiente: na dúvida, silêncio + registro.
        if (!res.addressed || !res.message) {
          setHandoverState("parecia conversa com outra pessoa — fiquei quieta e registrei.");
          void persist({
            mission_id: missionId ?? null,
            kind: "sensor_reading",
            channel: "foreground",
            note: turn.slice(0, 2000),
            meta: { session_id: sessionId, type: "handover_skipped", reason: "terceiros" },
          });
          release();
          return;
        }

        setHandoverState(null);
        actuators.chime("tick");
        if (wasListening) speechRef.current.stop();
        void persist({
          mission_id: missionId ?? null,
          kind: "dialog_turn",
          channel: "voice",
          note: question.slice(0, 4000),
          meta: { session_id: sessionId, role: "user", source: "live_handover" },
        });
        void persist({
          mission_id: missionId ?? null,
          kind: "dialog_turn",
          channel: "foreground",
          note: res.message.slice(0, 4000),
          meta: { session_id: sessionId, role: "assistant", source: "live_handover" },
        });
        toast("WiMi", { description: res.message, duration: 12000 });
        actuators.speak(res.message, {
          onEnd: () => {
            actuators.chime("soft");
            if (wasListening) speechRef.current.start();
            release();
          },
        });
      } catch (e) {
        setHandoverState(null);
        toast.error(e instanceof Error ? e.message : "Falha ao responder.");
        release();
      }
    },
    [actuators, missionId, persist, sessionId],
  );

  // Detector de fim de turno: ~2s sem fala nova e com a WiMi calada.
  useEffect(() => {
    if (!dynamic || !speech.listening) return;
    lastSpeechAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (actuators.speaking || respondingRef.current) {
        lastSpeechAtRef.current = Date.now();
        return;
      }
      if (Date.now() - lastSpeechAtRef.current < HANDOVER_MS) return;
      const turn = turnRef.current.join(" ").trim();
      lastSpeechAtRef.current = Date.now();
      if (!turn) return;
      turnRef.current = [];
      // o evento continua existindo para gatilhos de evento "silêncio".
      emitEvent("silence", { silence_ms: HANDOVER_MS });
      void handleHandover(turn);
    }, 400);
    return () => window.clearInterval(id);
  }, [actuators.speaking, dynamic, emitEvent, handleHandover, speech.listening]);


  const currentLine = useMemo(
    () => `${liveLine} ${speech.interim}`.trim(),
    [liveLine, speech.interim],
  );

  // Códigos de comunicação: detectados no texto parcial, sem esperar o bloco.
  useEffect(() => {
    if (!dynamic || !currentLine) return;
    lastSpeechAtRef.current = Date.now();
    handleCodes(currentLine);
  }, [currentLine, dynamic, handleCodes]);




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

  // -------------------------------------------------- MOTOR DE GATILHOS
  const triggersQ = useQuery({ queryKey: ["triggers"], queryFn: listTriggers });
  // Comandos de voz armados — contador discreto no overlay, nunca na fila.
  const commandsArmed = useMemo(
    () => armedCommands((triggersQ.data ?? []) as TriggerDefinition[]).length,
    [triggersQ.data],
  );

  const applyAction = useCallback(
    (action: TriggerAction, trigger: TriggerDefinition, info?: { matched_text?: string }) => {
      const results: import("@/lib/triggers").ActionResult[] = [];
      const ok = (label: string, detail?: string) =>
        results.push({ action: label, success: true, detail });
      const fail = (label: string, detail: string) =>
        results.push({ action: label, success: false, detail });

      try {
        if (action.stop_actuators) {
          actuators.stopAll();
          ok("desligar atuadores");
        }
        if (action.vibrate) {
          actuators.setVibrationConfig({
            onSec: action.vibrate.onSec,
            everySec: action.vibrate.everySec ?? 30,
            mode: action.vibrate.continuous ? "continuous" : "timed",
          });
          actuators.setVibration(true);
          const supported = typeof navigator !== "undefined" && "vibrate" in navigator;
          results.push({
            action: "vibrar",
            success: supported,
            detail: supported ? `${action.vibrate.onSec}s` : "aparelho sem API de vibração",
          });
        }
        if (action.audio_tone) {
          actuators.setAudioConfig({
            onSec: action.audio_tone.onSec,
            everySec: action.audio_tone.everySec ?? 60,
            mode: action.audio_tone.continuous ? "continuous" : "timed",
          });
          actuators.setAudio(true);
          ok("tom de áudio", `${action.audio_tone.onSec}s`);
        }
        if (action.sensors) {
          const { mic, camera: cam } = action.sensors;
          if (mic === false && speech.listening) {
            speech.stop();
            flushTranscript();
          }
          if (mic === true && !speech.listening) speech.start();
          if (cam === false) camera.stop();
          if (cam === true && !camera.live) void camera.toggle();
          ok(
            "sensores",
            Object.entries(action.sensors)
              .map(([k, v]) => `${k}=${v ? "on" : "off"}`)
              .join(" "),
          );
        }

        if (action.custom?.plan || action.custom?.instruction) {
          toast(`gatilho: ${trigger.name}`, {
            description: action.custom.plan ?? action.custom.instruction,
            duration: 8000,
          });
          ok("ação personalizada", action.custom.plan ?? action.custom.instruction);
        }
      } catch (e) {
        fail("primitivas", e instanceof Error ? e.message : "erro ao aplicar ações");
      }

      // ELEMENTO PROMPT — instrução em linguagem natural executada pela LLM.
      if (action.prompt?.instruction) {
        ok("prompt", "enviado à WiMi");
        const elapsedMin = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000));
        const contextText = [
          `Sessão ao vivo há ${elapsedMin} min.`,
          info?.matched_text ? `Frase que acionou o comando: "${info.matched_text}"` : "",
          bufferRef.current.length
            ? `Últimas falas transcritas:\n${bufferRef.current.slice(-8).join("\n")}`
            : "Sem transcrição recente.",
        ]
          .filter(Boolean)
          .join("\n");
        void runTriggerPrompt({
          data: {
            instruction: action.prompt.instruction,
            context: contextText,
            trigger_name: trigger.name,
          },
        })
          .then((res: { message: string }) => {
            toast(`WiMi · ${trigger.name}`, { description: res.message, duration: 12000 });
            actuators.speak(res.message);
            // O disparo já foi gravado; o RETORNO da IA chega depois, então vira
            // uma linha própria (append-only) para aparecer no relatório.
            void recordFiring({
              trigger_id: trigger.id,
              source_kind: "prompt_result",
              source_ref: `prompt:${trigger.id}:${Date.now()}`,
              result: "executed",
              meta: {
                type: "prompt_result",
                instruction: action.prompt?.instruction ?? "",
                action_results: [
                  { action: "prompt (resposta da WiMi)", success: true, detail: res.message },
                ],
              },
            }).catch(() => {});
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
            const detail = e instanceof Error ? e.message : "falha ao responder";
            toast.error(detail);
            void recordFiring({
              trigger_id: trigger.id,
              source_kind: "prompt_result",
              source_ref: `prompt:${trigger.id}:${Date.now()}`,
              result: "failed",
              meta: {
                type: "prompt_result",
                action_results: [{ action: "prompt (resposta da WiMi)", success: false, detail }],
              },
            }).catch(() => {});
          });
      }

      // INTERAÇÃO LIVRE — a WiMi toma a palavra e devolve o turno ao microfone.
      if (action.free_interaction) {
        ok("interação livre", "turno passado à WiMi");
        const elapsedMin = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000));
        const recent = blocksRef.current.slice(-8);
        const wasListening = speech.listening;
        // sinal de turno: a WiMi vai falar
        actuators.chime("tick");
        if (wasListening) speech.stop();
        void runTriggerPrompt({
          data: {
            instruction:
              action.free_interaction.instruction ??
              "Continue a conversa ao vivo: comente o que ouviu e faça UMA pergunta curta que ajude a pessoa a seguir executando.",
            context: [
              `Sessão ao vivo há ${elapsedMin} min.`,
              recent.length ? `Últimas falas:\n${recent.join("\n")}` : "Sem transcrição recente.",
            ].join("\n"),
            trigger_name: trigger.name,
          },
        })
          .then((res: { message: string }) => {
            toast(`WiMi · ${trigger.name}`, { description: res.message, duration: 12000 });
            actuators.speak(res.message, {
              onEnd: () => {
                // devolve o turno: toque curto e microfone de volta.
                actuators.chime("soft");
                if (wasListening) speech.start();
              },
            });
            void recordFiring({
              trigger_id: trigger.id,
              source_kind: "free_interaction",
              source_ref: `free:${trigger.id}:${Date.now()}`,
              result: "executed",
              meta: {
                type: "free_interaction",
                action_results: [{ action: "interação livre", success: true, detail: res.message }],
              },
            }).catch(() => {});
            void persist({
              mission_id: missionId ?? null,
              kind: "sensor_reading",
              channel: "foreground",
              note: res.message,
              meta: {
                session_id: sessionId,
                type: "free_interaction",
                trigger_id: trigger.id,
              },
            });
          })
          .catch((e: unknown) => {
            if (wasListening) speech.start();
            const detail = e instanceof Error ? e.message : "falha na interação livre";
            toast.error(detail);
            void recordFiring({
              trigger_id: trigger.id,
              source_kind: "free_interaction",
              source_ref: `free:${trigger.id}:${Date.now()}`,
              result: "failed",
              meta: {
                type: "free_interaction",
                action_results: [{ action: "interação livre", success: false, detail }],
              },
            }).catch(() => {});
          });
      }

      if (action.journey_log_prompt) {
        ok("abrir log de jornada");
        const elapsedMin = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 60000));
        const recent = blocksRef.current.slice(-8);
        const ctx: JourneyLogContext = {
          sessionId,
          missionId: missionId ?? null,
          missionTitle: null,
          elapsedMin,
          recentTranscript: recent.slice(-3),
          triggerName: trigger.name,
        };
        setJourneyLog(ctx);
        // MANIFESTAÇÃO FALADA COM CONTEXTO: a WiMi olha o que ouviu e pergunta
        // algo específico, em vez de repetir a mesma frase genérica.
        void runTriggerPrompt({
          data: {
            instruction:
              "Faça UMA pergunta curta e específica ao usuário sobre o que ele está executando agora, usando o contexto abaixo. Se não houver contexto, pergunte de forma acolhedora o que ele está fazendo.",
            context: [
              `Sessão ao vivo há ${elapsedMin} min.`,
              recent.length ? `Últimas falas:\n${recent.join("\n")}` : "Sem transcrição recente.",
            ].join("\n"),
            trigger_name: trigger.name,
          },
        })
          .then((res: { message: string }) => {
            setJourneyLog((prev) => (prev ? { ...prev, question: res.message } : prev));
            actuators.speak(res.message);
          })
          .catch(() => {
            actuators.speak("O que você está executando agora?");
          });
      }
      toast(`gatilho: ${trigger.name}`, {
        description: action.message ?? info?.matched_text ?? undefined,
      });
      if (action.message) {
        actuators.speak(action.message);
        ok("mensagem falada", action.message);
      }

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
          matched_text: info?.matched_text ?? null,
        },
      });

      return results;
    },
    [actuators, camera, flushTranscript, missionId, persist, sessionId, sessionStartedAt, speech],
  );

  // Época da escuta: muda a cada bloco fechado, reiniciando as âncoras de
  // dedupe do casamento por palavra-chave.
  const [heardEpoch, setHeardEpoch] = useState(0);
  useEffect(() => {
    setHeardEpoch((n) => n + 1);
  }, [blocks.length]);

  useTriggerEngine(
    (triggersQ.data ?? []) as TriggerDefinition[],
    {
      active: !offline,
      sessionStartedAt,
      lastBlock,
      liveText: { text: currentLine, epoch: heardEpoch },
      event: liveEvent,
    },
    { applyAction },
  );

  const pauseAll = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      flushTranscript();
    }
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
          vibrationOn={actuators.vibrationOn}
          audioOn={actuators.audioOn}
          wakeActive={wake.active}
          transcriptLines={[...blocks.slice(-3).map((b) => b.text), currentLine].filter(Boolean)}
          blocksSaved={blocksSaved}
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
                label: speech.listening ? "ouvindo e transcrevendo" : "sessão Live parada",
                detail: `${blocksSaved} blocos`,
              }}
              commandsCount={commandsArmed}
              big
            />
          }
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* RELÓGIO — herdado do antigo Palco, agora topo do Live. */}
      <section className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
        <LiveClock />
        {header}
      </section>

      <NextActionsOverlay
        triggers={(triggersQ.data ?? []) as TriggerDefinition[]}
        sessionStartedAt={sessionStartedAt}
        now={{
          label: speech.listening ? "ouvindo e transcrevendo" : "sessão Live parada",
          detail: `${blocksSaved} blocos`,
        }}
        commandsCount={commandsArmed}
        onOpenCommands={onOpenCommands}
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

        {/* LIVE DINÂMICO — análise contínua + endereçamento + handover. */}
        <button
          type="button"
          onClick={() => setDynamic((v) => !v)}
          aria-pressed={dynamic}
          className={`mt-3 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left active:scale-[0.99] ${
            dynamic ? "border-ember/50 bg-ember/5" : "border-border bg-charcoal-950/30"
          }`}
        >
          <Radio
            className={`h-4 w-4 shrink-0 ${dynamic ? "text-ember" : "text-muted-foreground"}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-foreground">Live dinâmico</span>
            <span className="block text-[11px] text-muted-foreground">
              {dynamic
                ? addressMode === "free"
                  ? "modo livre: ela acompanha e responde ao fim do seu turno."
                  : "ela acompanha tudo e só responde quando você usa o código de chamada."
                : "conversa por turnos: ela analisa enquanto você fala e responde no handover."}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
              dynamic ? "bg-ember/20 text-ember" : "bg-charcoal-800 text-muted-foreground"
            }`}
          >
            {dynamic ? "on" : "off"}
          </span>
        </button>

        {dynamic ? (
          <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-charcoal-950/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">responde</span>
              {(
                [
                  ["addressed", "só quando eu chamar"],
                  ["free", "modo livre"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeAddressMode(m)}
                  aria-pressed={addressMode === m}
                  className={`rounded-full border px-3 py-1 text-[11px] active:scale-95 ${
                    addressMode === m
                      ? "border-ember bg-ember/15 text-ember"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">códigos de chamada</span>
              {callCodes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeCodes(callCodes.filter((x) => x !== c))}
                  className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground active:scale-95"
                  aria-label={`remover código ${c}`}
                >
                  {c} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value)}
                placeholder="novo código (ex.: assistente)"
                className="min-w-0 flex-1 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-ember/50"
              />
              <button
                type="button"
                onClick={() => {
                  const c = codeDraft.trim();
                  if (!c) return;
                  changeCodes([...callCodes, c]);
                  setCodeDraft("");
                }}
                className="rounded-lg border border-ember/40 bg-ember/10 px-3 py-1.5 text-[12px] text-ember active:scale-95"
              >
                add
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {understanding
                ? `entendimento atual: ${understanding}`
                : "diga “WiMi, modo livre” para liberar, ou “WiMi, só quando eu chamar” para voltar."}
            </p>
            {handoverState ? (
              <p className="text-[11px] text-ember">{handoverState}</p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => openSessionTalk()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-[12px] text-muted-foreground active:scale-95"
        >
          <MessagesSquare className="h-4 w-4" /> Conversar sobre a sessão
        </button>


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
        <VoiceRow
          on={actuators.speechOn}
          speaking={actuators.speaking}
          supported={actuators.speechSupported}
          onToggle={actuators.toggleSpeech}
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

      {/* REGISTRO — o log do antigo Palco, colapsável dentro do Live. */}
      <ExecutionLogCard />
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
                ? config.beacon?.on
                  ? `beacon · a cada ${config.beacon.value} ${config.beacon.unit}`
                  : showSound
                    ? "armado · silencioso (só toca quando algo dispara)"
                    : continuous
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
          {showSound ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Configuração do padrão sonoro. Ligado sozinho, o áudio fica armado e silencioso — só
              toca quando um gatilho, uma manifestação ou o beacon abaixo disparar.
            </p>
          ) : null}
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

          {showSound ? <BeaconConfig config={config} onConfig={onConfig} /> : null}

          {continuous ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {showSound
                ? "Padrão contínuo: quando disparado, o timbre se repete uma vez em rajada curta."
                : "Sem duração definida: o padrão se repete até você desligar."}
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

/**
 * BEACON DE PRESENÇA — camada de timer dentro do bloco de áudio.
 * Não cria emissor novo: quando ligado, o agendador único de áudio passa a
 * usar este intervalo (número livre + unidade s/min).
 */
function BeaconConfig({
  config,
  onConfig,
}: {
  config: ActuatorConfig;
  onConfig: (c: ActuatorConfig) => void;
}) {
  const beacon = config.beacon ?? { on: false, value: 60, unit: "s" as BeaconUnit };
  const set = (patch: Partial<typeof beacon>) =>
    onConfig({ ...config, beacon: { ...beacon, ...patch } });

  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        beacon.on ? "border-ember/40 bg-ember/5" : "border-border/70"
      }`}
    >
      <button
        type="button"
        onClick={() => set({ on: !beacon.on })}
        aria-pressed={beacon.on}
        className="flex w-full items-center gap-2 text-left active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-foreground">Beacon de presença</span>
          <span className="block text-[11px] text-muted-foreground">
            {beacon.on
              ? `sinal a cada ${beacon.value} ${beacon.unit} — emissão única`
              : "sinal periódico discreto, desligado"}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            beacon.on ? "bg-ember/20 text-ember" : "bg-charcoal-800 text-muted-foreground"
          }`}
        >
          {beacon.on ? "on" : "off"}
        </span>
      </button>

      {beacon.on ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={999}
              value={beacon.value}
              onChange={(e) => set({ value: Number(e.target.value) })}
              aria-label="Intervalo do beacon"
              className="w-20 shrink-0 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1 text-sm text-foreground"
            />
            {(["s", "min"] as BeaconUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={beacon.unit === u}
                onClick={() => set({ unit: u })}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] active:scale-95 ${
                  beacon.unit === u
                    ? "border-ember bg-ember/15 text-ember"
                    : "border-border text-muted-foreground"
                }`}
              >
                {u === "s" ? "segundos" : "minutos"}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {INTERVAL_PRESETS.map((sec: number) => {
              const preset =
                sec < 60
                  ? { value: sec, unit: "s" as BeaconUnit }
                  : { value: sec / 60, unit: "min" as BeaconUnit };
              const active = beaconIntervalSec(beacon) === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set(preset)}
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
          <p className="mt-2 text-[11px] text-muted-foreground">
            O beacon é a única fonte de som periódico automático. Desligado, o bloco de áudio fica em
            silêncio total.
          </p>

        </>
      ) : null}
    </div>
  );
}

function VoiceRow({
  on,
  speaking,
  supported,
  onToggle,
}: {
  on: boolean;
  speaking: boolean;
  supported: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        on ? "border-ember/50 bg-ember/5" : "border-border bg-charcoal-950/30"
      }`}
    >
      <button
        type="button"
        disabled={!supported}
        aria-pressed={on}
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left disabled:opacity-40 active:scale-[0.99]"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            on ? "bg-ember/20 text-ember" : "bg-charcoal-800 text-muted-foreground"
          } ${speaking ? "animate-pulse ring-2 ring-ember" : ""}`}
        >
          <Radio className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-foreground">Voz das manifestações</span>
          <span className="block text-[11px] text-muted-foreground">
            {!supported
              ? "Síntese de voz indisponível neste navegador."
              : on
                ? "a WiMi fala o que se manifesta, com o contexto da sessão"
                : "desligada · manifestações só em texto"}
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
    </div>
  );
}
