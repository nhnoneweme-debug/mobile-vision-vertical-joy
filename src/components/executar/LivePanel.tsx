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
  Loader2,
  Send,
  SwitchCamera,
  Vibrate,
  Volume2,
  WifiOff,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { detectLang, langName, type ReplyLang } from "@/lib/lang-detect";
import { buildPersonaDirective, getActivePersonaModel } from "@/lib/persona-studio";

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
import {
  ensureVoices,
  listVoices,
  pickVoice,
  setVoicePref,
  langBase,
  speakWithVoice,
  defaultLocale,
  SAMPLE_PHRASES,
  NO_VOICE_HINT,
} from "@/lib/tts-voices";
import {
  DEGRADE_HINT,
  SERVER_VOICES,
  getEngine,
  getServerVoice,
  onTtsDegrade,
  setEngine,
  setServerVoice,
  speakUnified,
  type DegradeReason,
  type TtsEngine,
} from "@/lib/tts-engine";
import { logExecutionEvent, type LogExecutionEventInput } from "@/lib/execution.functions";
import { StationMode } from "./StationMode";
import { NextActionsOverlay } from "./NextActionsOverlay";
import { JourneyLogSheet, type JourneyLogContext } from "./JourneyLogSheet";
import { setLiveSessionStart } from "@/hooks/useLiveSession";
import { LiveClock } from "./LiveClock";
import { useTodayEntries } from "./TodayTimeline";
import { ExecutionLogCard } from "./ExecutionLogCard";
import {
  AttachButton,
  AttachChips,
  AttachmentCards,
  releasePending,
  uploadAttachments,
  type AttachmentRef,
  type PendingAttachment,
} from "./Attachments";
import { ExpandButton, ExpandedSheet } from "./ScrollBox";

import { liveHandoverReply, liveSessionChat, liveUnderstanding } from "@/lib/live-dialog.functions";
import {
  DEFAULT_PERSONA,
  PERSONA_LABEL,
  PERSONA_ROLE,
  PERSONA_DEFAULT_SERVER_VOICE,
  detectDirectPersona,
  getPersonaDeviceVoice,
  getPersonaServerVoice,
  normalizePersona,
  resolvePersonaChoice,
  setPersonaDeviceVoice,
  setPersonaServerVoice,
  type Persona,
} from "@/lib/personas";
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

/** Normaliza texto para comparar bloco falado × versão enviada (sem duplicar). */
function normalizeForMatch(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type TranscriptBlock = {
  id: string;
  text: string;
  saved: boolean;
  revision: number;
  at: number;
  /** duração da fala captada (quando fizer sentido mostrar) */
  durationMs?: number;
};

/**
 * FLUXO ÚNICO DO OUVIDO — transcrição, digitação, manifestações da WiMi e
 * eventos de sistema convivem na MESMA superfície cronológica.
 */
type FeedKind = "typed" | "assistant" | "system";

type FeedEntry = {
  id: string;
  kind: FeedKind;
  text: string;
  at: number;
  persona?: Persona;
  label?: string;
  attachments?: AttachmentRef[];
};

type ChatItem =
  | { key: string; at: number; type: "mic"; block: TranscriptBlock }
  | { key: string; at: number; type: "feed"; entry: FeedEntry };

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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
  const langRef = useRef(lang);
  langRef.current = lang;
  /** últimas detecções de idioma; 2 seguidas viram troca do reconhecedor. */
  const langHistoryRef = useRef<ReplyLang[]>([]);
  const [langNote, setLangNote] = useState<string | null>(null);
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

  // Chat fluido: tudo que não vem do microfone entra aqui e é mesclado por hora.
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [composer, setComposer] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [stick, setStick] = useState(true);
  const [unread, setUnread] = useState(false);

  const addressModeRef = useRef<AddressMode>("addressed");
  const callCodesRef = useRef<string[]>([]);
  const understandingRef = useRef<string | null>(null);
  const respondingRef = useRef(false);
  /** histórico curto da conversa (composer + manifestações) para o contexto */
  const chatHistoryRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  /** fala acumulada do turno atual (esvaziada a cada handover) */
  const turnRef = useRef<string[]>([]);
  addressModeRef.current = addressMode;
  callCodesRef.current = callCodes;

  // Anexos pendentes no composer + containment do fluxo.
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandFlow, setExpandFlow] = useState(false);
  /** Regime corrente lido de dentro de callbacks estáveis (manual vs dinâmico). */
  const dynamicRef = useRef(false);
  dynamicRef.current = dynamic;
  // DITADO NO COMPOSER (regime manual): o texto nasce dentro da caixa de
  // edição enquanto a pessoa fala. base = rascunho antes do bloco atual;
  // live = último trecho espelhado; suppress = usuário reescreveu à mão.
  const dictBaseRef = useRef<string | null>(null);
  const dictLiveRef = useRef("");
  const dictSuppressRef = useRef(false);

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

  const pushFeed = useCallback((entry: Omit<FeedEntry, "id" | "at"> & { at?: number }) => {
    setFeed((prev) => [
      ...prev.slice(-60),
      { id: newId("fd"), at: entry.at ?? Date.now(), ...entry },
    ]);
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

  // STUDIO DE PERSONAS: o modelo ativo do usuário alimenta o roteamento e o
  // prompt de sistema das manifestações. Sem modelo salvo, vale o preset padrão.
  const personaDirectiveRef = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getActivePersonaModel()
      .then((p) => {
        if (alive && p) personaDirectiveRef.current = buildPersonaDirective(p);
      })
      .catch(() => {
        /* sem modelo salvo: preset padrão do servidor */
      });
    return () => {
      alive = false;
    };
  }, []);
  const personaExtras = useCallback(
    () => (personaDirectiveRef.current ? { persona_directive: personaDirectiveRef.current } : {}),
    [],
  );

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
      {
        id: blockId,
        text,
        saved: false,
        revision: 0,
        at: endedAt,
        durationMs: startedAt ? endedAt - startedAt : undefined,
      },
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

    // REGIME MANUAL (Dinâmico OFF): o texto já nasceu no composer (ditado ao
    // vivo). Na pausa o trecho SOBE para o fluxo consolidado (acima) e o
    // rascunho permanece editável na caixa, acumulando a fala contínua.
    if (!dynamicRef.current) {
      if (!dictSuppressRef.current) {
        const base = dictBaseRef.current ?? "";
        setComposer(`${base} ${text}`.trim().replace(/\s+/g, " "));
      }
      dictBaseRef.current = null;
      dictLiveRef.current = "";
      dictSuppressRef.current = false;
    }
  }, [emitEvent, lang, missionId, persist, sessionId]);

  const onFinalText = useCallback(
    (text: string) => {
      if (blockStartRef.current == null) blockStartRef.current = Date.now();
      lastSpeechAtRef.current = Date.now();
      bufferRef.current.push(text);
      turnRef.current.push(text);
      setLiveLine(bufferRef.current.join(" "));
      // SELETOR INVISÍVEL: o reconhecedor nativo exige idioma fixo. Se o texto
      // transcrito sair consistentemente em outro idioma suportado, trocamos o
      // reconhecedor sozinhos (custo conhecido: ~1 frase de atraso na virada).
      const guess = detectLang(text);
      if (guess) {
        const hist = [...langHistoryRef.current.slice(-1), guess];
        langHistoryRef.current = hist;
        if (
          hist.length === 2 &&
          hist[0] === guess &&
          guess !== langRef.current &&
          LANGS.some((l) => l.code === guess)
        ) {
          langHistoryRef.current = [];
          changeLang(guess);
          setLangNote(`escutando em ${langName(guess).toLowerCase()}`);
          window.setTimeout(() => setLangNote(null), 6000);
        }
      }
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(flushTranscript, SILENCE_MS);
    },
    [changeLang, flushTranscript],
  );

  /** Fala sempre no idioma da sessão, com voz explícita do idioma. */
  const speakLive = useCallback(
    (text: string, opts?: { onEnd?: () => void; persona?: Persona; lang?: string }) =>
      actuators.speak(text, {
        ...opts,
        // A fala sai no idioma que o modelo respondeu (reply_lang); sem ele,
        // no idioma corrente da sessão.
        lang: opts?.lang ?? lang,
        persona: opts?.persona ?? DEFAULT_PERSONA,
      }),
    [actuators, lang],
  );

  /** Manifestação assinada: entra no fluxo e é lida com a voz da identidade. */
  const manifest = useCallback(
    (text: string, persona: Persona, opts?: { onEnd?: () => void; lang?: string | null }) => {
      pushFeed({ kind: "assistant", text, persona });
      chatHistoryRef.current = [...chatHistoryRef.current.slice(-12), { role: "assistant", text }];
      speakLive(text, { persona, onEnd: opts?.onEnd, ...(opts?.lang ? { lang: opts.lang } : {}) });
    },
    [pushFeed, speakLive],
  );

  const speech = useSpeechToText(onFinalText, { lang });
  const speechRef = useRef(speech);
  speechRef.current = speech;

  // -------------------------------------------------- CONTEÚDO DA SESSÃO
  //
  // O chat do ouvido enxerga TUDO que foi coletado: transcrição da sessão,
  // o que foi digitado/respondido no fluxo e os registros reais do dia.
  const todayEntries = useTodayEntries();
  const todayRef = useRef<string>("");
  todayRef.current = todayEntries
    .map((e) => `${e.time} · ${e.kindLabel}: ${e.title}${e.detail ? ` — ${e.detail}` : ""}`)
    .join("\n");
  const feedRef = useRef<FeedEntry[]>([]);
  feedRef.current = feed;

  const sessionContent = useCallback(
    () =>
      [
        blocksRef.current.length ? `Transcrição da sessão:\n${blocksRef.current.join("\n")}` : "",
        turnRef.current.join(" "),
        speechRef.current.interim,
        feedRef.current.length
          ? `Fluxo da conversa:\n${feedRef.current
              .map(
                (f) =>
                  `${clock(f.at)} ${
                    f.kind === "assistant" ? PERSONA_LABEL[f.persona ?? DEFAULT_PERSONA] : "Você"
                  }: ${f.text}`,
              )
              .join("\n")}`
          : "",
        todayRef.current ? `Registros e jornada de hoje:\n${todayRef.current}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(-12000),
    [],
  );

  /**
   * Pergunta ao par WiMi dentro do próprio fluxo (sem tela separada).
   * Chamar "Wi" ou "Mi" diretamente força a identidade; senão o modelo decide.
   */
  const askSession = useCallback(
    async (question: string, attachments?: AttachmentRef[]) => {
      const q = question.trim();
      if ((!q && !attachments?.length) || chatBusy) return;
      const forced = detectDirectPersona(q);
      pushFeed({ kind: "typed", text: q, attachments });

      chatHistoryRef.current = [...chatHistoryRef.current.slice(-12), { role: "user", text: q }];
      setChatBusy(true);
      try {
        const res = await liveSessionChat({
          data: {
            session_context: sessionContent(),
            history: chatHistoryRef.current.slice(-10),
            question: q.slice(0, 2000),
            ...(forced ? { force_persona: forced } : {}),
            ...personaExtras(),
          },
        });
        const persona = normalizePersona(res.persona);
        manifest(res.message, persona, { lang: res.reply_lang });
        void persist({
          mission_id: missionId ?? null,
          kind: "dialog_turn",
          channel: "manual",
          note: q.slice(0, 4000),
          meta: { session_id: sessionId, role: "user", source: "live_chat" },
        });
        void persist({
          mission_id: missionId ?? null,
          kind: "dialog_turn",
          channel: "foreground",
          note: res.message.slice(0, 4000),
          meta: { session_id: sessionId, role: "assistant", source: "live_chat", persona },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao responder.");
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, manifest, missionId, persist, pushFeed, sessionContent, sessionId],
  );

  /**
   * ÚNICO PONTO DE ENVIO da tela: sobe os anexos pendentes (bucket privado do
   * usuário) e manda texto + referências pra WiMi.
   */
  const submitComposer = useCallback(async () => {
    const text = composer.trim();
    if ((!text && pending.length === 0) || chatBusy || uploading) return;
    let refs: AttachmentRef[] = [];
    if (pending.length > 0) {
      setUploading(true);
      try {
        refs = await uploadAttachments(pending);
        releasePending(pending);
        setPending([]);
        void persist({
          mission_id: missionId ?? null,
          kind: "manual_log",
          channel: "manual",
          note: text.slice(0, 4000) || `${refs.length} anexo(s)`,
          meta: { session_id: sessionId, source: "live_composer", attachments: refs },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao anexar.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    setComposer("");
    dictBaseRef.current = null;
    dictLiveRef.current = "";
    dictSuppressRef.current = false;
    // SEM DUPLICATA: o que já subiu ao contexto como bloco discreto e está
    // contido na versão enviada some da tela (segue persistido no histórico).
    if (text) {
      const normSent = normalizeForMatch(text);
      setBlocks((prev) => prev.filter((b) => !normSent.includes(normalizeForMatch(b.text))));
    }
    await askSession(text, refs.length ? refs : undefined);
  }, [askSession, chatBusy, composer, missionId, pending, persist, sessionId, uploading]);

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
        manifest(
          mode === "free" ? "Modo livre: respondo a tudo." : "Ok, só quando você me chamar.",
          "wi",
        );
        turnRef.current = [];
        return;
      }
      if (detectSessionTalk(tail)) {
        turnRef.current = [];
        void askSession("Do que a gente falou até agora? Faça um resumo do que foi dito.");
      }
    },
    // changeAddressMode é estável (definido abaixo com useCallback sem deps)
    [actuators, askSession, changeAddressMode, manifest],
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
        const direct = detectDirectPersona(turn);
        const res = await liveHandoverReply({
          data: {
            turn: question.slice(0, 4000),
            understanding: understandingRef.current || undefined,
            recent: blocksRef.current.slice(-6).join("\n").slice(-4000) || undefined,
            addressed_by_code: !!code,
            ...(direct ? { force_persona: direct } : {}),
            ...personaExtras(),
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
        const persona = normalizePersona(res.persona);
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
          meta: { session_id: sessionId, role: "assistant", source: "live_handover", persona },
        });
        toast(PERSONA_LABEL[persona], { description: res.message, duration: 12000 });
        manifest(res.message, persona, {
          lang: res.reply_lang,
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
    [actuators, manifest, missionId, persist, sessionId],
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

  // DITADO AO VIVO NO COMPOSER — regime manual: cada palavra reconhecida
  // aparece na caixa de edição (nada no fluxo consolidado ainda).
  useEffect(() => {
    if (dynamic) return;
    const live = currentLine.trim();
    if (!live || dictSuppressRef.current) return;
    setComposer((prev) => {
      if (dictBaseRef.current === null) dictBaseRef.current = prev;
      dictLiveRef.current = live;
      return `${dictBaseRef.current} ${live}`.trim().replace(/\s+/g, " ");
    });
  }, [currentLine, dynamic]);

  // Códigos de comunicação: detectados no texto parcial, sem esperar o bloco.
  useEffect(() => {
    if (!dynamic || !currentLine) return;
    lastSpeechAtRef.current = Date.now();
    handleCodes(currentLine);
  }, [currentLine, dynamic, handleCodes]);

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
      // QUEM MANIFESTA — "auto" (padrão) deixa o modelo escolher entre Wi e Mi.
      const triggerPersona = resolvePersonaChoice(action.persona);

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
            ...personaExtras(),
            session_lang: langRef.current,
            ...(triggerPersona ? { force_persona: triggerPersona } : {}),
          },
        })
          .then((res: { message: string; persona?: string; reply_lang?: string | null }) => {
            const persona = normalizePersona(res.persona);
            toast(`${PERSONA_LABEL[persona]} · ${trigger.name}`, {
              description: res.message,
              duration: 12000,
            });
            manifest(res.message, persona, { lang: res.reply_lang ?? null });
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
            ...personaExtras(),
            session_lang: langRef.current,
            ...(triggerPersona ? { force_persona: triggerPersona } : {}),
          },
        })
          .then((res: { message: string; persona?: string; reply_lang?: string | null }) => {
            const persona = normalizePersona(res.persona);
            toast(`${PERSONA_LABEL[persona]} · ${trigger.name}`, {
              description: res.message,
              duration: 12000,
            });
            manifest(res.message, persona, {
              lang: res.reply_lang ?? null,
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
            ...personaExtras(),
            session_lang: langRef.current,
            ...(triggerPersona ? { force_persona: triggerPersona } : { force_persona: "wi" }),
          },
        })
          .then((res: { message: string; persona?: string; reply_lang?: string | null }) => {
            setJourneyLog((prev) => (prev ? { ...prev, question: res.message } : prev));
            manifest(res.message, normalizePersona(res.persona), {
              lang: res.reply_lang ?? null,
            });
          })
          .catch(() => {
            manifest("O que você está executando agora?", "wi");
          });
      }
      toast(`gatilho: ${trigger.name}`, {
        description: action.message ?? info?.matched_text ?? undefined,
      });
      if (action.message) {
        manifest(action.message, triggerPersona ?? DEFAULT_PERSONA);
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
    [
      actuators,
      camera,
      flushTranscript,
      missionId,
      manifest,
      persist,
      sessionId,
      sessionStartedAt,
      speech,
    ],
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

  // ------------------------------------------------ FLUXO ÚNICO (chat fluido)
  const chatItems = useMemo<ChatItem[]>(() => {
    const items: ChatItem[] = [
      ...blocks.map((b) => ({ key: b.id, at: b.at, type: "mic" as const, block: b })),
      ...feed.map((f) => ({ key: f.id, at: f.at, type: "feed" as const, entry: f })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [blocks, feed]);

  // Auto-scroll respeitando a leitura em curso.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || editingId != null) return;
    if (stick) el.scrollTop = el.scrollHeight;
    else setUnread(true);
  }, [chatItems.length, currentLine, editingId, stick]);

  const jumpToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStick(true);
    setUnread(false);
  }, []);

  const flowItems = (
    <>
      {chatItems.length === 0 && !currentLine ? (
        <p className="text-muted-foreground">
          {speech.listening
            ? "ouvindo…"
            : "nada ainda — fale, escreva ou ligue o microfone. Tudo entra aqui."}
        </p>
      ) : null}

      {chatItems.map((item) =>
        item.type === "mic" ? (
          editingId === item.block.id ? (
            <textarea
              key={item.key}
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
              key={item.key}
              type="button"
              onClick={() => startEdit(item.block)}
              className="block w-full rounded-lg border border-border/40 bg-charcoal-900/50 px-2.5 py-1.5 text-left active:opacity-70"
            >
              <span className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Mic className="h-3 w-3 shrink-0" /> {clock(item.block.at)}
                {item.block.durationMs != null && item.block.durationMs > 1500 ? (
                  <span>· {Math.round(item.block.durationMs / 1000)}s</span>
                ) : null}
                {item.block.revision > 0 ? <span className="text-ember">· corrigido</span> : null}
                {!item.block.saved ? <span className="text-amber-400">· não salvo</span> : null}
              </span>
              <span className="mt-0.5 block text-muted-foreground">{item.block.text}</span>
            </button>
          )
        ) : item.entry.kind === "system" ? (
          <p
            key={item.key}
            className="text-center text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            {clock(item.at)} · {item.entry.text}
          </p>
        ) : item.entry.kind === "typed" ? (
          <div key={item.key} className="flex justify-end">
            <div className="max-w-[85%] rounded-xl rounded-br-sm bg-ember px-3 py-1.5 text-ember-foreground">
              <span className="block text-[10px] uppercase tracking-wide opacity-80">
                você · {clock(item.at)}
              </span>
              {item.entry.text ? (
                <span className="block whitespace-pre-wrap">{item.entry.text}</span>
              ) : null}
              <AttachmentCards items={item.entry.attachments} />
            </div>
          </div>
        ) : (
          <div key={item.key} className="max-w-[92%]">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ember">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ember/20 text-[8px] font-bold">
                {PERSONA_LABEL[item.entry.persona ?? DEFAULT_PERSONA]}
              </span>
              {PERSONA_LABEL[item.entry.persona ?? DEFAULT_PERSONA]} ·{" "}
              {PERSONA_ROLE[item.entry.persona ?? DEFAULT_PERSONA]} · {clock(item.at)}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.entry.text}</p>
          </div>
        ),
      )}

      {currentLine && dynamic ? (
        <p className="text-foreground">
          <span className="mr-1 text-[10px] uppercase tracking-wide text-ember">ouvindo</span>
          {currentLine}
        </p>
      ) : null}
      {chatBusy ? <p className="text-[11px] text-ember">WiMi está pensando…</p> : null}
    </>
  );

  const chatView = (
    <div className="relative mt-2">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          setStick(atEnd);
          if (atEnd) setUnread(false);
        }}
        // altura fixa ≈ 5 linhas: rolagem interna, o card não empurra a página.
        className="h-40 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-charcoal-950/40 px-3 py-2 text-[13px] leading-relaxed"
      >
        {flowItems}
      </div>

      {unread && !stick ? (
        <button
          type="button"
          onClick={jumpToEnd}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-ember/40 bg-charcoal-950/90 px-3 py-1 text-[11px] text-ember active:scale-95"
        >
          ↓ novas interações
        </button>
      ) : null}
    </div>
  );

  // COMPOSER ÚNICO — o único microfone e o único ponto de envio da tela.
  // O mic aqui é o mesmo ouvido da sessão (toggleListening): não existe
  // segundo reconhecedor nem segunda caixa.
  const composerView = (
    <div className="mt-3 space-y-2 rounded-2xl border border-border/60 bg-charcoal-950/40 p-2.5">
      <div className="relative">
        <textarea
          value={composer}
          onChange={(e) => {
            const v = e.target.value;
            setComposer(v);
            // Edição humana durante o ditado: re-ancora a base ou desliga o
            // espelhamento até o próximo bloco fechar.
            if (dictBaseRef.current !== null) {
              const live = dictLiveRef.current;
              const trimmed = v.trimEnd();
              if (live && trimmed.endsWith(live)) {
                dictBaseRef.current = trimmed.slice(0, trimmed.length - live.length).trimEnd();
              } else {
                dictSuppressRef.current = true;
                dictBaseRef.current = null;
              }
            }
          }}
          rows={2}
          placeholder={
            dynamic
              ? "Escreva pra WiMi — ou fale, que ela responde sozinha."
              : "Fale e o texto nasce aqui — revise e envie quando quiser retorno."
          }
          className="min-h-[56px] w-full resize-none rounded-xl border border-border bg-charcoal-950/60 px-3 py-2 pr-9 text-sm text-foreground outline-none focus:border-ember/50"
        />
        {composer ? (
          <button
            type="button"
            onClick={() => {
              setComposer("");
              dictBaseRef.current = null;
              dictLiveRef.current = "";
              dictSuppressRef.current = true;
            }}
            aria-label="Limpar rascunho"
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-foreground active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {!dynamic ? (
        <p className="text-[10px] leading-tight text-muted-foreground">
          {speech.listening
            ? "ditando aqui · na pausa o trecho sobe para o contexto e o rascunho continua editável"
            : "rascunho editável — envie quando quiser retorno da WiMi"}
        </p>
      ) : null}
      <AttachChips
        items={pending}
        onRemove={(id) =>
          setPending((prev) => {
            releasePending(prev.filter((a) => a.id === id));
            return prev.filter((a) => a.id !== id);
          })
        }
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleListening}
          disabled={!speech.supported || offline}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? "Parar de ouvir" : "Ouvir"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition disabled:opacity-40 active:scale-95 ${
            speech.listening
              ? "animate-pulse border-ember bg-ember/20 text-ember"
              : "border-border text-muted-foreground"
          }`}
        >
          {speech.listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
        <AttachButton
          disabled={uploading || chatBusy}
          onPick={(files) => setPending((prev) => [...prev, ...files])}
        />
        <button
          type="button"
          disabled={(!composer.trim() && pending.length === 0) || chatBusy || uploading}
          onClick={() => void submitComposer()}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2 text-[12px] text-ember disabled:opacity-40 active:scale-95"
        >
          {chatBusy || uploading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Send className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">
            {uploading ? "anexando…" : chatBusy ? "respondendo…" : "Enviar"}
          </span>
        </button>
      </div>
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
          transcriptLines={[
            ...chatItems
              .slice(-3)
              .map((i) =>
                i.type === "mic"
                  ? i.block.text
                  : `${
                      i.entry.kind === "assistant"
                        ? PERSONA_LABEL[i.entry.persona ?? DEFAULT_PERSONA]
                        : "você"
                    }: ${i.entry.text}`,
              ),
            currentLine,
          ].filter(Boolean)}
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
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <Ear className="h-3.5 w-3.5" /> Ouvidos
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {!speech.supported
              ? "Transcrição não suportada neste navegador."
              : speech.listening
                ? "Microfone ativo — transcrevendo em blocos."
                : "Microfone desligado — use o mic do campo abaixo."}
          </p>
        </div>

        {/* Uma linha só: idioma + regime (economia de área vertical). */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
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

          {/* LIVE DINÂMICO — toggle compacto na mesma linha. */}
          <button
            type="button"
            onClick={() => setDynamic((v) => !v)}
            aria-pressed={dynamic}
            className={`ml-auto inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] active:scale-95 ${
              dynamic
                ? "border-ember bg-ember/20 text-ember"
                : "border-border bg-charcoal-950/40 text-muted-foreground"
            }`}
          >
            <Radio className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Dinâmico</span>
            <span
              className={`shrink-0 rounded-full px-1.5 text-[9px] uppercase tracking-wide ${
                dynamic ? "bg-ember text-charcoal-900" : "bg-charcoal-800"
              }`}
            >
              {dynamic ? "on" : "off"}
            </span>
          </button>
        </div>

        {langNote ? (
          <p className="mt-1 text-[10px] text-ember" role="status">
            {langNote}
          </p>
        ) : null}

        {/* O que cada regime faz, em uma linha. */}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {dynamic
            ? addressMode === "free"
              ? "Dinâmico ON · modo livre: ela acompanha e responde sozinha no fim do seu turno."
              : "Dinâmico ON: ela acompanha tudo e se manifesta sozinha quando você usa o código de chamada."
            : "Dinâmico OFF (manual): cada bloco falado cai no campo acima pronto pra editar — só responde quando você enviar."}
        </p>

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
            {handoverState ? <p className="text-[11px] text-ember">{handoverState}</p> : null}
          </div>
        ) : null}

        {/* (a) COMPOSER ÚNICO no topo · (b) FLUXO CONSOLIDADO abaixo. */}
        {composerView}

        <div className="mt-3 flex items-center gap-2">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              Fluxo consolidado: fala, texto e respostas da Wi/Mi em ordem.
            </span>
          </p>
          <ExpandButton onClick={() => setExpandFlow(true)} />
        </div>

        {chatView}

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Pencil className="h-3 w-3" /> toque numa fala transcrita para corrigir — o mic continua
          ouvindo. {blocksSaved} bloco(s) salvos{saving ? " · salvando…" : ""}
        </p>
      </section>

      {expandFlow ? (
        <ExpandedSheet title="Fluxo do ouvido" onClose={() => setExpandFlow(false)}>
          <div className="space-y-2 text-[13px] leading-relaxed">{flowItems}</div>
        </ExpandedSheet>
      ) : null}

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
          lang={lang}
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
            O beacon é a única fonte de som periódico automático. Desligado, o bloco de áudio fica
            em silêncio total.
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
  lang,
}: {
  on: boolean;
  speaking: boolean;
  supported: boolean;
  onToggle: () => void;
  lang: string;
}) {
  const base = langBase(lang);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [engine, setEngineState] = useState<TtsEngine>("server");
  const [serverVoice, setServerVoiceState] = useState<string>("nova");
  const [degraded, setDegraded] = useState<DegradeReason | null>(null);

  useEffect(() => {
    setEngineState(getEngine());
    setServerVoiceState(getServerVoice());
    return onTtsDegrade(setDegraded);
  }, []);

  useEffect(() => {
    let alive = true;
    void ensureVoices().then(() => {
      if (!alive) return;
      const list = listVoices(base);
      setVoices(list);
      setSelected(pickVoice(base)?.voiceURI ?? "");
    });
    return () => {
      alive = false;
    };
  }, [base]);

  const onPick = (uri: string) => {
    setSelected(uri);
    setVoicePref(base, voices.find((v) => v.voiceURI === uri) ?? null);
  };

  const pickEngine = (next: TtsEngine) => {
    setEngineState(next);
    setEngine(next);
    if (next !== "server") setDegraded(null);
  };

  const sample = (eng: TtsEngine) =>
    void speakUnified(SAMPLE_PHRASES[base], {
      lang: defaultLocale(base),
      engine: eng,
      noCache: true,
    });

  const samplePersona = (persona: Persona) =>
    void speakUnified(`${PERSONA_LABEL[persona]} aqui. ${SAMPLE_PHRASES[base]}`, {
      lang: defaultLocale(base),
      engine,
      noCache: true,
      voice: getPersonaServerVoice(persona),
      deviceVoiceURI: getPersonaDeviceVoice(persona, base) ?? undefined,
    });

  const ENGINES: { id: TtsEngine; label: string; hint: string }[] = [
    { id: "server", label: "Voz do servidor", hint: "melhor qualidade · usa IA" },
    { id: "device", label: "Voz do aparelho", hint: "gratuita · depende das vozes instaladas" },
    { id: "text", label: "Só texto", hint: "sem áudio" },
  ];

  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        on ? "border-ember/50 bg-ember/5" : "border-border bg-charcoal-950/30"
      }`}
    >
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left active:scale-[0.99]"
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
            {on
              ? engine === "text"
                ? "manifestações só em texto"
                : engine === "server"
                  ? "voz do servidor · cai na voz do aparelho se faltar rede/saldo"
                  : "voz do aparelho (gratuita)"
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

      {on ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              Motor de voz
            </span>
            {ENGINES.map((e) => (
              <div
                key={e.id}
                className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 ${
                  engine === e.id ? "border-ember/50 bg-ember/10" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => pickEngine(e.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[12px] text-foreground">{e.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{e.hint}</span>
                </button>
                {e.id !== "text" ? (
                  <button
                    type="button"
                    onClick={() => sample(e.id)}
                    className="shrink-0 rounded-lg border border-ember/40 bg-ember/10 px-2 py-1 text-[11px] text-ember active:scale-95"
                  >
                    amostra
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* IDENTIDADES — cada uma com voz própria e amostra. */}
          {engine !== "text" ? (
            <div className="space-y-2">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                Vozes das identidades
              </span>
              {(["wi", "mi"] as const).map((persona) => (
                <PersonaVoice
                  key={persona}
                  persona={persona}
                  base={base}
                  engine={engine}
                  voices={voices}
                  onSample={() => samplePersona(persona)}
                />
              ))}
            </div>
          ) : null}

          {engine === "server" ? (
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                Timbre padrão do servidor (usado quando não há identidade)
              </label>
              <select
                value={serverVoice}
                onChange={(e) => {
                  setServerVoiceState(e.target.value);
                  setServerVoice(e.target.value);
                }}
                className="w-full min-w-0 rounded-lg border border-border bg-charcoal-950/60 px-2 py-2 text-[12px] text-foreground"
              >
                {SERVER_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              {degraded ? (
                <p className="rounded-lg border border-border bg-charcoal-950/50 p-2 text-[11px] text-muted-foreground">
                  {DEGRADE_HINT[degraded]}
                </p>
              ) : null}
            </div>
          ) : null}

          {engine !== "text" && supported && voices.length ? (
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                Voz do aparelho (
                {base === "pt" ? "português" : base === "en" ? "inglês" : "espanhol"})
              </label>
              <select
                value={selected}
                onChange={(e) => onPick(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-border bg-charcoal-950/60 px-2 py-2 text-[12px] text-foreground"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                    {v.localService ? "" : " · online"}
                  </option>
                ))}
              </select>
            </div>
          ) : engine !== "text" && !voices.length ? (
            <p className="rounded-lg border border-border bg-charcoal-950/50 p-2 text-[11px] text-muted-foreground">
              {NO_VOICE_HINT[base]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Voz de UMA identidade: Wi (tutora, feminina) e Mi (mentor, masculino) têm
 * timbre de servidor e voz de aparelho independentes.
 */
function PersonaVoice({
  persona,
  base,
  engine,
  voices,
  onSample,
}: {
  persona: Persona;
  base: ReturnType<typeof langBase>;
  engine: TtsEngine;
  voices: SpeechSynthesisVoice[];
  onSample: () => void;
}) {
  const [serverVoice, setServer] = useState<string>(PERSONA_DEFAULT_SERVER_VOICE[persona]);
  const [deviceVoice, setDevice] = useState<string>("");

  useEffect(() => {
    setServer(getPersonaServerVoice(persona));
    setDevice(getPersonaDeviceVoice(persona, base) ?? "");
  }, [base, persona]);

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/20 text-[11px] font-bold text-ember">
          {PERSONA_LABEL[persona]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] text-foreground">
            {PERSONA_LABEL[persona]} · {PERSONA_ROLE[persona]}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {persona === "wi" ? "voz feminina" : "voz masculina"}
          </span>
        </span>
        <button
          type="button"
          onClick={onSample}
          className="shrink-0 rounded-lg border border-ember/40 bg-ember/10 px-2 py-1 text-[11px] text-ember active:scale-95"
        >
          amostra
        </button>
      </div>

      {engine === "server" ? (
        <select
          value={serverVoice}
          onChange={(e) => {
            setServer(e.target.value);
            setPersonaServerVoice(persona, e.target.value);
          }}
          className="mt-2 w-full min-w-0 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1.5 text-[12px] text-foreground"
        >
          {SERVER_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      ) : voices.length ? (
        <select
          value={deviceVoice}
          onChange={(e) => {
            setDevice(e.target.value);
            setPersonaDeviceVoice(persona, base, e.target.value || null);
          }}
          className="mt-2 w-full min-w-0 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1.5 text-[12px] text-foreground"
        >
          <option value="">automática</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
