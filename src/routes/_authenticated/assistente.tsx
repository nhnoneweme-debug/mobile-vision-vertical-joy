import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  Send,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  MessageSquarePlus,
  History,
  SlidersHorizontal,
  Trash2,
  Pencil,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Loader2,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Zap,
  Scale,
  Brain,
} from "lucide-react";
import { loadEffort, saveEffort, type Effort } from "@/lib/ai-effort";
import { useGoBack } from "@/hooks/useGoBack";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
// Nota: o voltar sai do header (item 2). No desktop a sidebar já leva de
// volta; no mobile ele vira o primeiro botão da barra inferior do composer,
// ao alcance do polegar direito.
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  clientMomentHeaders,
  formatMomentLabel,
  getClientMoment,
  type ClientMoment,
} from "@/lib/client-moment";
import { createHabit, archiveHabit, type HabitFrequency } from "@/lib/habits";
import { createMission, archiveMission, type MissionType } from "@/lib/missions";
import { createWorkoutPlan, deleteWorkoutPlan } from "@/lib/workouts.functions";
import { saveDietPlan, restoreDietPlan } from "@/lib/cozinha.functions";
import { resizeImageFile } from "@/lib/image-utils";
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  getChatSettings,
  saveChatSettings,
  CHAT_SETTINGS_DEFAULT,
  ASSISTANT_NAME_FALLBACK,
  ASSISTANT_NAME_MAX,
  assistantName,
  assistantGreeting,
  renameConversation,
  type Conversation,
  type ChatSettings,
} from "@/lib/assistant.functions";
import type { Proposal } from "@/routes/api/assistant";
import { useActiveJourney } from "@/hooks/useActiveJourney";
import { JourneyStrip } from "@/components/assistente/JourneyStrip";
import { JourneyAgent, type JourneyManifestation } from "@/components/assistente/JourneyAgent";
import { vibrateFor, playPing } from "@/components/assistente/JourneyManifestFX";
import {
  loadAgreements,
  saveAgreements,
  recordChoice,
  DEFAULT_AGREEMENTS,
  type JourneyAgreements,
  type JourneyPhase,
  type JourneyNotifyChannels,
} from "@/lib/journey-agreements";
import { markMissionToday } from "@/lib/missions";
import { syncJourneyPushSchedule } from "@/lib/journey-schedule.functions";
import { suggestActions } from "@/lib/journey-suggestions";
import type { JourneySuggestion } from "@/lib/journey-suggestions";


// Saudação inicial antes das settings chegarem; troca pelo nome escolhido assim
// que carregam (o fallback é "WiMi").
const GREETING = assistantGreeting(ASSISTANT_NAME_FALLBACK);
const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME_FALLBACK} — Inteligência Digital` }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    seed: typeof s.seed === "string" ? s.seed : undefined,
  }),
  component: AssistantPage,
});

// Prompts iniciais para cada "caminho" do estúdio da Home. Cada seed gera um
// texto pronto no composer para que o usuário só ajuste e envie.
const SEED_PROMPTS: Record<string, string> = {
  planejar:
    "Vamos planejar juntos. Quero estruturar minha vida de forma holística — comece me perguntando qual área devo priorizar hoje (trabalho, emocional, espiritual, físico ou relacionamentos) e me guie passo a passo.",
  executar:
    "Preciso executar. Olhe minhas metas e missões agendadas de hoje, monte um plano focado para as próximas horas e me diga por onde começar.",
  refletir:
    "Quero refletir. Use meu diário, sonhos e registros recentes como base e conduza uma reflexão profunda sobre quem sou, onde estou e para onde quero ir.",
  descansar:
    "Quero descansar melhor. Primeiro me ajude a mapear o que é descanso pra mim, depois monte rituais e pausas que caibam na minha rotina.",
  "planejar-dia":
    "Acabei de acordar. Vamos planejar meu dia agora — olhe minha agenda, meus hábitos e metas, e proponha uma sequência realista de blocos para hoje. Ao final, ofereça mandar tudo para /executar.",
};

type ImageAttachment = { base64: string; mediaType: string };
type ProposalMsg = {
  id: number;
  role: "proposal";
  proposal: Proposal;
  status: "pending" | "done" | "cancel";
  cta?: { to: string; label: string };
  ctas?: { to: string; label: string }[];
};
export type ManifestAction = {
  id: string;
  label: string;
  intent: "primary" | "secondary" | "ghost";
  // Retorna true se a ação já persistiu algo (evita duplicar).
  run: () => void | Promise<void>;
};
type Msg =
  | { id: number; role: "assistant"; text: string; actions?: ManifestAction[]; consumed?: boolean }
  | { id: number; role: "user"; text: string; images?: ImageAttachment[] }
  | ProposalMsg;

let seq = 0;
const nid = () => ++seq;

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"]; // Dom..Sáb (bit = 1<<idx)
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const freqMap: Record<string, HabitFrequency> = {
  diario: "daily",
  semanal: "weekly",
  mensal: "monthly",
};
const tipoMap: Record<string, MissionType> = {
  unico: "one_off",
  diario: "daily",
  semanal: "weekly",
};

function AssistantPage() {
  const fnCreatePlan = useServerFn(createWorkoutPlan);
  const fnDeletePlan = useServerFn(deleteWorkoutPlan);
  const fnSaveDiet = useServerFn(saveDietPlan);
  const fnRestoreDiet = useServerFn(restoreDietPlan);
  const fnListConversations = useServerFn(listConversations);
  const fnGetConversation = useServerFn(getConversationMessages);
  const fnDeleteConversation = useServerFn(deleteConversation);
  const fnRenameConversation = useServerFn(renameConversation);
  const fnGetSettings = useServerFn(getChatSettings);
  const fnSaveSettings = useServerFn(saveChatSettings);

  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: nid(), role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<Record<number, () => Promise<void>>>({});

  // Conversas + configuração da IA
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convOpen, setConvOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(CHAT_SETTINGS_DEFAULT);
  const [savingCfg, setSavingCfg] = useState(false);

  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Autoplay do TTS: quando ligado, toca a resposta assim que fica pronta.
  // Guardado em localStorage — decisão do usuário no dispositivo, sem migration.
  const [autoplay, setAutoplay] = useState(false);
  // Expansão do campo de texto — "manual" (padrão, botão) ou "auto" (ao focar).
  // Guardado em localStorage: preferência por dispositivo, sem migration.
  const [expandMode, setExpandMode] = useState<"manual" | "auto">("manual");
  const [composerExpanded, setComposerExpanded] = useState(false);
  // Nível de raciocínio da IA — Rápido / Equilibrado / Profundo.
  // Persistido no localStorage (compartilhado com /conversar) e lido via ref
  // no envio pra a troca valer já na PRÓXIMA mensagem, sem congelar.
  const [effort, setEffort] = useState<Effort>("medium");
  const effortRef = useRef<Effort>("medium");
  // Estado do TTS por mensagem: idle | loading | playing | paused | error.
  // Apenas UMA mensagem toca por vez; ao trocar, aborta a anterior.
  type TtsState = "loading" | "playing" | "paused";
  const [ttsMsgId, setTtsMsgId] = useState<number | null>(null);
  const [ttsState, setTtsState] = useState<TtsState>("loading");
  // Momento local do usuário (fuso + hora agora) — enviado nos headers e
  // exibido como chip de auditoria. Atualiza de minuto em minuto.
  const [moment, setMoment] = useState<ClientMoment | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Sequência monotônica: só callbacks do áudio "atual" têm efeito.
  // Sem isso, um MP3 antigo que erra depois de tocar aciona speakFallback e
  // dispara uma segunda voz (Web Speech) por cima do novo áudio.
  const ttsGenRef = useRef(0);
  // Espelham voiceMode/autoplay para closures assíncronas (o `send` termina
  // segundos depois do gesture; ler direto do state pega o valor da render
  // que iniciou o envio e o autoplay recém-ligado pode não ser visto).
  const autoplayRef = useRef(false);
  const voiceModeRef = useRef(false);
  // Referência ao wrapper do composer p/ colapsar em auto-mode ao clicar fora.
  const composerWrapRef = useRef<HTMLDivElement | null>(null);
  const sttPreviewRef = useRef<HTMLDivElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { canGoBack, goBack } = useGoBack();

  // Menu do nível de raciocínio (chip compacto na barra superior).
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const effortMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!effortMenuOpen) return;
    function onDown(ev: MouseEvent | TouchEvent) {
      const el = effortMenuRef.current;
      if (el && !el.contains(ev.target as Node)) setEffortMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [effortMenuOpen]);

  // Acordos de acompanhamento da jornada (preEnd/atEnd/preStart em minutos).
  // Guardados no localStorage — decisão por dispositivo, sem migration.
  // Passar `agreementsVersion` para o JourneyAgent força reler quando muda.
  const [agreements, setAgreements] = useState<JourneyAgreements>(DEFAULT_AGREEMENTS);
  const [agreementsVersion, setAgreementsVersion] = useState(0);
  useEffect(() => {
    setAgreements(loadAgreements());
  }, []);
  function updateAgreements(patch: Partial<JourneyAgreements>) {
    setAgreements((prev) => {
      const next = { ...prev, ...patch };
      saveAgreements(next);
      setAgreementsVersion((v) => v + 1);
      return next;
    });
  }

  // Bloco atual + próximo da agenda (missões com scheduled_time hoje).
  const journey = useActiveJourney();

  // Restaura preferência de autoplay do dispositivo (item 3).
  useEffect(() => {
    try {
      setAutoplay(localStorage.getItem("wimi.tts.autoplay") === "1");
      const mode = localStorage.getItem("wimi.composer.expandMode");
      if (mode === "auto" || mode === "manual") setExpandMode(mode);
    } catch {
      /* noop */
    }
    const e = loadEffort();
    setEffort(e);
    effortRef.current = e;
  }, []);

  // Consome ?seed=... vindo do estúdio da Home e pré-preenche o composer.
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    const seed = search.seed;
    if (!seed) return;
    // Deep-link vindo do push da jornada: "manifest:<missionId>:<phase>".
    if (seed.startsWith("manifest:")) {
      const [, , rawPhase] = seed.split(":");
      const phase = (rawPhase as JourneyPhase) ?? "atEnd";
      const label =
        phase === "preStart"
          ? "Voltei pra começar o próximo bloco. O que é primeiro?"
          : phase === "preEnd"
            ? "Estou aqui — como fecho esse bloco?"
            : "Terminou. Bora fechar como feito?";
      setMsgs((prev) => [
        ...prev,
        { id: nid(), role: "assistant", text: label },
      ]);
    } else {
      const prompt = SEED_PROMPTS[seed];
      if (prompt) setInput((prev) => (prev ? prev : prompt));
    }
    // Limpa a query para não reaplicar em reloads / navegação de volta.
    void navigate({ search: { seed: undefined }, replace: true });
  }, [search.seed, navigate]);

  // Sincroniza a agenda de manifestações push (celular travado) sempre que
  // a jornada ou os acordos mudarem. Import via useServerFn abaixo.
  const fnSyncJourney = useServerFn(syncJourneyPushSchedule);
  useEffect(() => {
    if (!userId || journey.loading) return;
    const tz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC";
    const missions = journey.blocks
      .filter((b) => b.raw?.id && b.raw?.scheduled_time)
      .map((b) => ({
        id: b.raw.id,
        title: b.raw.title ?? b.title,
        area: b.area,
        scheduled_time: b.raw.scheduled_time as string,
        end_time: b.raw.end_time ?? null,
      }));

    void fnSyncJourney({
      data: {
        tz,
        agreements: {
          preEnd: agreements.preEnd,
          atEnd: agreements.atEnd,
          preStart: agreements.preStart,
        },
        notify: agreements.notify,
        missions,
      },
    }).catch(() => {
      /* silencioso — o push é um extra, o foreground continua funcionando */
    });
  }, [userId, journey.blocks, journey.loading, agreements, fnSyncJourney]);


  const {
    listening,
    supported: sttSupported,
    interim: sttInterim,
    preview: sttPreview,
    start: startListening,
    stop: stopListening,
  } = useSpeechToText((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));

  useEffect(() => {
    const el = sttPreviewRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sttPreview, sttInterim, listening]);

  async function handleImageSelect(files: FileList | null) {
    if (!files?.length) return;
    const MAX_IMAGES = 3;
    const remaining = MAX_IMAGES - pendingImages.length;
    const toProcess = Array.from(files).slice(0, remaining);
    if (toProcess.length === 0) {
      toast.error(`Máximo ${MAX_IMAGES} imagens por mensagem.`);
      return;
    }
    try {
      const processed = await Promise.all(toProcess.map((f) => resizeImageFile(f)));
      setPendingImages((prev) => [...prev, ...processed]);
    } catch {
      toast.error("Não consegui processar a imagem.");
    }
    if (imgInputRef.current) imgInputRef.current.value = "";
  }

  function removePendingImage(idx: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // Captura o momento local (fuso + hora agora) na montagem e revalida a
  // cada 30s para o chip do topo espelhar o horário sem lag perceptível.
  useEffect(() => {
    setMoment(getClientMoment());
    const id = window.setInterval(() => setMoment(getClientMoment()), 30_000);
    return () => window.clearInterval(id);
  }, []);



  // Sincroniza refs com state — closure fresca em qualquer async.
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Auto-mode: recolhe o composer quando o usuário clica fora dele.
  useEffect(() => {
    if (!composerExpanded || expandMode !== "auto") return;
    function onDown(ev: MouseEvent | TouchEvent) {
      const el = composerWrapRef.current;
      if (!el) return;
      const t = ev.target as Node | null;
      if (t && !el.contains(t)) setComposerExpanded(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [composerExpanded, expandMode]);

  function toggleVoice() {
    if (voiceMode && listening) {
      stopListening();
      setVoiceMode(false);
      return;
    }
    if (voiceMode && !listening) {
      startListening();
      return;
    }
    if (!sttSupported) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    setVoiceMode(true);
    startListening();
  }

  function stopCurrentTts() {
    // Invalida callbacks pendentes do áudio anterior.
    ttsGenRef.current += 1;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* noop */
      }
      audioRef.current.onplay = null;
      audioRef.current.onpause = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setTtsMsgId(null);
  }

  async function unlockAudioPlayback() {
    const audio = hiddenAudioRef.current;
    if (!audio) return;
    try {
      const previousSrc = audio.currentSrc || audio.src;
      audio.muted = true;
      audio.volume = 0;
      audio.src = SILENT_AUDIO_SRC;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      if (previousSrc && previousSrc !== SILENT_AUDIO_SRC) audio.src = previousSrc;
    } catch {
      audio.muted = false;
      audio.volume = 1;
    }
  }

  /**
   * Prepara texto para leitura em voz: remove blocos/inlines de código,
   * links markdown, URLs cruas e símbolos de markdown. Sem isso o TTS lê
   * "```typescript", nomes de funções e endereços http — soa como uma
   * segunda voz em inglês no meio da resposta.
   */
  function sanitizeForTts(raw: string): string {
    let t = raw;
    t = t.replace(/```[\s\S]*?```/g, " ");
    t = t.replace(/`[^`]*`/g, " ");
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    t = t.replace(/https?:\/\/\S+/gi, " ");
    t = t.replace(/[*_>#~`|]+/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    return t;
  }

  /**
   * Toca o TTS da mensagem `msgId` com estado ao vivo (loading → playing).
   * Se a mesma mensagem já está tocando, pausa; se está pausada, retoma;
   * se outra está tocando, aborta e recomeça.
   */
  async function playMessageTts(msgId: number, text: string) {
    if (!text.trim()) return;
    if (voiceModeRef.current || listening) {
      stopListening();
      setVoiceMode(false);
      voiceModeRef.current = false;
    }
    if (ttsMsgId === msgId && audioRef.current) {
      if (ttsState === "playing") {
        audioRef.current.pause();
        setTtsState("paused");
      } else if (ttsState === "paused") {
        void unlockAudioPlayback();
        audioRef.current.play().catch(() => stopCurrentTts());
        setTtsState("playing");
      }
      return;
    }
    void unlockAudioPlayback();
    stopCurrentTts();
    const gen = ++ttsGenRef.current;
    const cleaned = sanitizeForTts(text);
    if (!cleaned) return;
    setTtsMsgId(msgId);
    setTtsState("loading");
    let started = false;
    try {
      const r = await fetch("/api/assistant-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: cleaned, gender: settings.voice_gender }),
      });
      if (gen !== ttsGenRef.current) return;
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      if (gen !== ttsGenRef.current) return;
      if (blob.size === 0) throw new Error("empty-audio");
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = hiddenAudioRef.current ?? new Audio();
      audio.preload = "auto";
      audio.volume = 1;
      audio.muted = false;
      audio.src = url;
      audioRef.current = audio;
      audio.onplay = () => {
        if (gen !== ttsGenRef.current) return;
        started = true;
        setSpeaking(true);
        setTtsState("playing");
      };
      audio.onpause = () => {
        if (gen !== ttsGenRef.current) return;
        if (!audio.ended) setTtsState("paused");
      };
      audio.onended = () => {
        if (gen !== ttsGenRef.current) return;
        setSpeaking(false);
        stopCurrentTts();
      };
      audio.onerror = () => {
        if (gen !== ttsGenRef.current) return;
        // Se o MP3 já começou, NÃO acione o fallback — evita duas vozes.
        if (started) {
          stopCurrentTts();
          return;
        }
        stopCurrentTts();
        speakFallback(cleaned, msgId);
      };
      await audio.play();
    } catch (err) {
      if (gen !== ttsGenRef.current) return;
      stopCurrentTts();
      if (!started) {
        speakFallback(cleaned, msgId);
        toast.error("O navegador bloqueou o áudio. Toque no play da resposta para liberar o som.");
        console.warn("TTS playback failed", err);
      }
    }
  }

  function pickPtBrVoice(gender: "feminina" | "masculina"): SpeechSynthesisVoice | null {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const ptbr = voices.filter((v) => /pt(-|_)?BR/i.test(v.lang) || /pt(-|_)?PT/i.test(v.lang));
    if (!ptbr.length) return null;
    const femHints = /(female|mulher|luciana|joana|helena|maria|monica|paulina|catarina|fernanda|camila|vitoria)/i;
    const maleHints = /(male|homem|felipe|ricardo|daniel|paulo|joão|joao|diego|thiago|antonio)/i;
    const wanted = gender === "feminina" ? femHints : maleHints;
    const other = gender === "feminina" ? maleHints : femHints;
    return (
      ptbr.find((v) => wanted.test(v.name)) ??
      ptbr.find((v) => !other.test(v.name)) ??
      ptbr[0]
    );
  }

  function speakFallback(text: string, msgId?: number) {
    if (!("speechSynthesis" in window)) {
      setTtsMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(sanitizeForTts(text));
    utter.lang = "pt-BR";
    utter.rate = 1;
    const v = pickPtBrVoice(settings.voice_gender);
    if (v) utter.voice = v;
    utter.onstart = () => {
      setSpeaking(true);
      if (msgId != null) {
        setTtsMsgId(msgId);
        setTtsState("playing");
      }
    };
    utter.onend = () => {
      setSpeaking(false);
      setTtsMsgId(null);
    };
    utter.onerror = () => {
      setSpeaking(false);
      setTtsMsgId(null);
    };
    window.speechSynthesis.speak(utter);
  }

  /** Rename manual — a IA nunca sobrescreve isto depois (ver nomear_conversa). */
  async function commitRename(id: string, titulo: string) {
    const limpo = titulo.trim().slice(0, 80);
    setRenamingId(null);
    const atual = conversations.find((c) => c.id === id)?.title;
    if (!limpo || limpo === atual) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: limpo } : c)));
    try {
      await fnRenameConversation({ data: { id, title: limpo } });
    } catch {
      toast.error("Não consegui renomear.");
      void refreshConversations();
    }
  }

  async function refreshConversations() {
    try {
      setConversations(await fnListConversations());
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    (async () => {
      let convs: Conversation[] = [];
      try {
        convs = await fnListConversations();
        setConversations(convs);
      } catch {
        /* sem histórico */
      }
      let s: ChatSettings = CHAT_SETTINGS_DEFAULT;
      try {
        s = await fnGetSettings();
        setSettings(s);
      } catch {
        /* usa defaults */
      }
      // Retomar a última conversa quando o usuário preferir; senão, saudação nova.
      if (s.open_mode === "last" && convs.length > 0) {
        try {
          const last = convs[0];
          const hist = await fnGetConversation({ data: { conversation_id: last.id } });
          if (hist.length) {
            setConversationId(last.id);
            setMsgs(
              hist.map((h) => ({ id: nid(), role: h.role, text: h.content }) as Msg),
            );
            return;
          }
        } catch {
          /* cai no fluxo padrão */
        }
      }
      setMsgs((prev) =>
        prev.length === 1 && prev[0].role === "assistant"
          ? [{ id: nid(), role: "assistant", text: assistantGreeting(assistantName(s)) }]
          : prev,
      );
    })();
  }, [fnListConversations, fnGetSettings]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking]);

  function startNewConversation() {
    setConversationId(null);
    setMsgs([{ id: nid(), role: "assistant", text: assistantGreeting(assistantName(settings)) }]);
    setConvOpen(false);
  }

  async function loadConversation(id: string) {
    setConvOpen(false);
    setConversationId(id);
    try {
      const hist = await fnGetConversation({ data: { conversation_id: id } });
      setMsgs(
        hist.length
          ? hist.map((h) => ({ id: nid(), role: h.role, text: h.content }) as Msg)
          : [{ id: nid(), role: "assistant", text: GREETING }],
      );
    } catch {
      toast.error("Não consegui carregar a conversa.");
    }
  }

  async function removeConversation(id: string) {
    try {
      await fnDeleteConversation({ data: { id } });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === conversationId) startNewConversation();
      toast("Conversa apagada.");
    } catch {
      toast.error("Não consegui apagar.");
    }
  }

  async function persistSettings(next: ChatSettings) {
    setSettings(next);
    setSavingCfg(true);
    try {
      await fnSaveSettings({ data: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar config.");
    } finally {
      setSavingCfg(false);
    }
  }

  type MsgInput = Msg extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;
  function push(m: MsgInput) {
    setMsgs((prev) => [...prev, { ...(m as Msg), id: nid() }]);
  }
  function patchProposal(id: number, patch: Partial<ProposalMsg>) {
    setMsgs((prev) =>
      prev.map((m) => (m.id === id && m.role === "proposal" ? { ...m, ...patch } : m)),
    );
  }
  function updateData(id: number, data: Proposal["data"]) {
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === id && m.role === "proposal"
          ? { ...m, proposal: { ...m.proposal, data } as Proposal }
          : m,
      ),
    );
  }

  async function send(text: string) {
    const t = text.trim();
    const imgs = pendingImages;
    if ((!t && !imgs.length) || thinking) return;
    const voiceWasActive = voiceModeRef.current || listening;
    if (voiceWasActive) {
      stopListening();
      setVoiceMode(false);
      voiceModeRef.current = false;
    }
    const convo = msgs
      .filter(
        (m): m is Extract<Msg, { role: "user" | "assistant" }> =>
          m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({
        role: m.role,
        text: m.text,
        ...(m.role === "user" && m.images ? { images: m.images } : {}),
      }));
    push({ role: "user", text: t || "(imagem)", ...(imgs.length ? { images: imgs } : {}) });
    setInput("");
    setPendingImages([]);
    setThinking(true);

    // Bolha do assistente que cresce token a token (criada no 1º delta).
    let assistantId: number | null = null;
    const appendDelta = (delta: string) => {
      if (assistantId == null) {
        const idNew = nid();
        assistantId = idNew;
        setThinking(false);
        setMsgs((prev) => [...prev, { id: idNew, role: "assistant", text: delta }]);
      } else {
        const idCur = assistantId;
        setMsgs((prev) =>
          prev.map((m) =>
            m.id === idCur && m.role === "assistant" ? { ...m, text: m.text + delta } : m,
          ),
        );
      }
    };

    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...clientMomentHeaders(),
        },
        body: JSON.stringify({
          messages: [...convo, { role: "user", text: t, ...(imgs.length ? { images: imgs } : {}) }],
          conversation_id: conversationId ?? undefined,
          effort: effortRef.current,
        }),
      });
      if (!r.ok || !r.body) throw new Error(String(r.status));

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError = false;
      let full = "";
      const isNewConversation = conversationId == null;

      // Consome o SSE: eventos separados por linha em branco, cada um "data: {json}".
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: { type: string; delta?: string; proposals?: Proposal[]; id?: string };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (evt.type === "conversation" && evt.id) {
            setConversationId(evt.id);
          } else if (evt.type === "text" && evt.delta) {
            full += evt.delta;
            appendDelta(evt.delta);
          } else if (evt.type === "proposals") {
            for (const p of evt.proposals ?? [])
              push({ role: "proposal", proposal: p, status: "pending" });
          } else if (evt.type === "error") {
            sawError = true;
          }
        }
      }

      if (sawError && assistantId == null) {
        appendDelta("Tive um problema pra responder agora. Tenta de novo?");
      }
      const shouldSpeak = (voiceWasActive || autoplayRef.current) && full.trim() && assistantId != null;
      if (shouldSpeak) void playMessageTts(assistantId!, full.trim());
      if (isNewConversation) void refreshConversations();
    } catch {
      if (assistantId == null) appendDelta("Tive um problema pra responder agora. Tenta de novo?");
    } finally {
      setThinking(false);
    }
  }

  async function confirm(msg: ProposalMsg) {
    if (!userId) {
      toast.error("Faça login.");
      return;
    }
    const p = msg.proposal;
    try {
      if (p.kind === "habito") {
        const h = await createHabit(userId, {
          title: p.data.titulo,
          frequency: freqMap[p.data.frequencia] ?? "weekly",
          target: p.data.meta ?? 1,
          area_slug: p.data.area,
        });
        undoRef.current[msg.id] = async () => {
          await archiveHabit(h.id);
        };
        patchProposal(msg.id, { status: "done", cta: { to: "/home", label: "Ver na Home" } });
      } else if (p.kind === "compromisso") {
        const mask = (p.data.dias_semana ?? []).reduce((acc, d) => acc | (1 << d), 0);
        const type: MissionType = p.data.tipo ? tipoMap[p.data.tipo] : mask ? "weekly" : "one_off";
        const m = await createMission(userId, {
          title: p.data.titulo,
          mission_type: type,
          scheduled_time: p.data.horario_inicio ?? null,
          end_time: p.data.horario_fim ?? null,
          weekday_mask: mask || 127,
        });
        undoRef.current[msg.id] = async () => {
          await archiveMission(m.id);
        };
        patchProposal(msg.id, {
          status: "done",
          ctas: [
            { to: "/agenda", label: "Ver na Agenda" },
            { to: "/executar", label: "Executando agora" },
          ],
        });
      } else if (p.kind === "treino") {
        const days = p.data.dias.map((d) => ({
          id: uid(),
          dia: d.dia,
          foco: d.foco,
          exercicios: d.exercicios.map((e) => ({
            id: uid(),
            nome: e.nome,
            series: e.series,
            reps: e.reps,
          })),
        }));
        const plan = await fnCreatePlan({ data: { name: p.data.nome, days, source: "ai" } });
        undoRef.current[msg.id] = async () => {
          await fnDeletePlan({ data: { id: plan.id } });
        };
        patchProposal(msg.id, { status: "done", cta: { to: "/treino", label: "Ver no Treino" } });
      } else {
        const meals = p.data.refeicoes.map((r) => ({
          time: r.horario,
          name: r.nome,
          items: r.itens,
        }));
        const { previous } = await fnSaveDiet({
          data: { name: p.data.nome, hydration_ml: p.data.hidratacao_ml, meals },
        });
        undoRef.current[msg.id] = async () => {
          await fnRestoreDiet({ data: { plan: previous } });
        };
        patchProposal(msg.id, {
          status: "done",
          cta: { to: "/area/cozinha", label: "Ver na Dieta" },
        });
      }
      toast.success("Criado com sucesso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui criar. Tenta de novo.");
    }
  }

  async function undo(msg: ProposalMsg) {
    const fn = undoRef.current[msg.id];
    if (!fn) return;
    try {
      await fn();
      delete undoRef.current[msg.id];
      patchProposal(msg.id, { status: "cancel", cta: undefined });
      toast("Desfeito.");
    } catch {
      toast.error("Não consegui desfazer.");
    }
  }

  function cancel(msg: ProposalMsg) {
    patchProposal(msg.id, { status: "cancel" });
    push({ role: "assistant", text: "Sem problema. Quer ajustar o pedido? É só me falar." });
  }

  /** Handler das manifestações da WiMi disparadas pelo JourneyAgent.
   *  Injeta uma mensagem local (role=assistant) com 3 sugestões dinâmicas
   *  que executam a ação real quando tocadas (marcar feito, estender, etc.). */
  const manifestHandler = useCallback(
    (m: JourneyManifestation) => {
      const kind = (m.block.area ?? "geral") || "geral";
      const phase = m.phase;
      const missionRaw = m.block.raw;

      const doMarkDone = async () => {
        if (userId) {
          try {
            await markMissionToday(missionRaw, userId, true);
            toast.success("Registrado como feito.");
            journey.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não consegui registrar.");
          }
        }
      };
      const doMarkSkip = async () => {
        if (userId) {
          try {
            await markMissionToday(missionRaw, userId, false);
            toast("Registrado como não realizado.");
            journey.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não consegui registrar.");
          }
        }
      };

      const actions: ManifestAction[] = m.suggestions.map((s: JourneySuggestion) => ({
        id: s.id,
        label: s.label,
        intent: s.intent,
        run: async () => {
          recordChoice(kind, phase, s.id);
          if (s.id === "done" || s.id === "rest_done") await doMarkDone();
          else if (s.id === "skip") await doMarkSkip();
          else if (s.id === "log_note") setInput((prev) => (prev ? prev : "Registrar sobre isto: "));
          else if (s.id === "check_in") setInput((prev) => (prev ? prev : "Preciso de ajuda com isso agora: "));
          else if (s.id === "extend" || s.id === "rest_more") {
            setInput((prev) => (prev ? prev : "Estender esse bloco em 5 minutos."));
          } else if (s.id === "reschedule") {
            setInput((prev) => (prev ? prev : "Adiar esse bloco em 10 minutos."));
          } else if (s.id === "start_now" || s.id === "start_rest" || s.id === "ready") {
            setInput((prev) => (prev ? prev : "Começando agora."));
          } else if (s.id === "focus_next") {
            setInput((prev) => (prev ? prev : "Me lembre do próximo passo do plano."));
          }
        },
      }));

      setMsgs((prev) => [...prev, { id: nid(), role: "assistant", text: m.message, actions }]);
      const notify = agreements.notify;
      if (notify.vibrate) vibrateFor(phase);
      if (notify.voice && autoplayRef.current) {
        const idPreview = seq;
        void playMessageTts(idPreview, m.message);
      } else if (notify.vibrate) {
        // Sem voz: um "ping" curto ajuda a chamar atenção quando o TTS
        // está desligado. Autoplay/AudioContext desbloqueado no shell.
        playPing(phase);
      }
      if (notify.autoMic && !listening) {
        // Abre o microfone para o usuário responder por voz no ato.
        setTimeout(() => {
          try {
            startListening();
          } catch {
            /* noop */
          }
        }, 500);
      }


    },
    // playMessageTts é estável dentro do componente pra este uso; deps mínimas
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, journey, agreements, listening, startListening],

  );

  return (
    <MobileShell>
      <audio ref={hiddenAudioRef} className="hidden" preload="auto" />
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-4 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        {/* Voltar movido pra barra inferior (ao alcance do polegar direito).
            No desktop a sidebar cuida da navegação. */}
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-none tracking-wide text-foreground">
            {assistantName(settings).toUpperCase()}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span className="truncate">Inteligência Digital</span>
            {moment ? (
              <span
                title={`Fuso: ${moment.timezone}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-charcoal-800/70 px-2 py-1 text-[11px] font-display uppercase tracking-[0.12em] text-muted-foreground"
              >
                <span aria-hidden>⏱</span>
                <span>{formatMomentLabel(moment)}</span>
              </span>
            ) : null}
            {voiceMode ? (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-ember/15 px-1.5 py-0.5 text-[9px] font-display tracking-[0.15em] text-ember">
                {listening ? "🎙 OUVINDO" : speaking ? "🔊 FALANDO" : "🎤 VOZ"}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      {/* Painel de execução viva — mostra o AGORA / A SEGUIR baseado nas
          missões com horário para hoje. Não renderiza se nada estiver
          agendado. O JourneyAgent (sem UI) manifesta a WiMi no chat quando
          cruza os gatilhos negociados com o usuário. */}
      <JourneyStrip journey={journey} />
      <JourneyAgent
        journey={journey}
        onManifest={manifestHandler}
        agreementsVersion={agreementsVersion}
      />

      <div className="space-y-3 px-4 pt-4">

        {msgs.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[82%] space-y-1.5">
                  {m.images?.length ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {m.images.map((img, i) => (
                        <img
                          key={i}
                          src={`data:${img.mediaType};base64,${img.base64}`}
                          alt="anexo"
                          className="h-24 w-24 rounded-lg border border-border object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="rounded-2xl rounded-br-md bg-ember px-3.5 py-2.5 text-charcoal-900">
                    <p className="text-sm leading-snug">{m.text}</p>
                  </div>
                </div>
              </div>
            );
          }
          if (m.role === "assistant") {
            return (
              <div key={m.id} className="flex justify-start gap-1.5">
                <div className="flex max-w-[86%] flex-col gap-1.5">
                  <div className="forge-card rounded-2xl rounded-bl-md px-3.5 py-2.5">
                    {/* A IA responde em markdown (**negrito**, listas). Renderizar
                        como texto puro mostrava os asteriscos crus pro usuário —
                        mesmo padrão já usado no /conversar e no DumpChat. */}
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-snug text-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-display">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  </div>
                  {m.actions && m.actions.length > 0 && !m.consumed ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={async () => {
                            await a.run();
                            setMsgs((prev) =>
                              prev.map((x) =>
                                x.id === m.id && x.role === "assistant"
                                  ? { ...x, consumed: true }
                                  : x,
                              ),
                            );
                          }}
                          className={
                            "rounded-full px-2.5 py-1 text-[11px] font-display uppercase tracking-[0.12em] transition active:scale-95 " +
                            (a.intent === "primary"
                              ? "bg-ember text-charcoal-900 hover:brightness-110"
                              : a.intent === "secondary"
                                ? "border border-ember/40 text-ember hover:bg-ember/10"
                                : "border border-border text-muted-foreground hover:text-foreground")
                          }
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {(() => {
                  const active = ttsMsgId === m.id;
                  const st = active ? ttsState : "idle";
                  const Icon = st === "loading" ? Loader2 : st === "playing" ? Pause : Play;
                  return (
                    <button
                      type="button"
                      onClick={() => playMessageTts(m.id, m.text)}
                      aria-label={
                        st === "loading"
                          ? "Carregando áudio"
                          : st === "playing"
                            ? "Pausar leitura"
                            : "Ouvir resposta"
                      }
                      aria-pressed={active}
                      className={
                        "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border active:scale-95 " +
                        (active
                          ? "border-ember bg-ember/10 text-ember"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      <Icon
                        className={"h-3.5 w-3.5 " + (st === "loading" ? "animate-spin" : "")}
                      />
                    </button>
                  );
                })()}
              </div>
            );
          }
          return (
            <ProposalCard
              key={m.id}
              msg={m}
              onChange={(d) => updateData(m.id, d)}
              onConfirm={() => confirm(m)}
              onCancel={() => cancel(m)}
              onUndo={() => undo(m)}
            />
          );
        })}
        {thinking && (
          <div className="flex justify-start">
            <div className="forge-card rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm italic text-muted-foreground">
              pensando…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={listening ? "h-56" : "h-28"} />

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        {/* Preview ao vivo da transcrição enquanto o mic está aberto: janela de
            auditoria com 5 linhas. O texto final já cai no textarea abaixo. */}
        {listening ? (
          <div
            aria-live="polite"
            className="mb-2 flex items-start gap-2 rounded-xl border border-ember/30 bg-charcoal-800/95 px-3 py-2 shadow-[0_18px_40px_-24px_var(--ember)]"
          >
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-ember" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-[9px] tracking-[0.18em] text-ember/80">
                OUVINDO — AUDITE A TRANSCRIÇÃO
              </div>
              <div
                ref={sttPreviewRef}
                className="mt-1 h-[5.65rem] overflow-hidden font-mono text-[12px] leading-[1.13rem] text-foreground/90"
                style={{ overflowWrap: "anywhere" }}
              >
                {sttPreview || (
                  <span className="italic text-muted-foreground">fale que eu transcrevo…</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Barra de controles: voltar + nova + histórico + config + autoplay.
            Voltar movido pra cá pra ficar ao alcance do polegar (item 2). */}
        <div className="mb-2 flex items-center justify-center gap-1.5">
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Voltar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-charcoal-900/60 text-muted-foreground hover:text-foreground active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={startNewConversation}
            className="flex items-center gap-1.5 rounded-full border border-border bg-charcoal-900/60 px-2.5 py-1.5 font-display text-[10px] tracking-[0.15em] text-muted-foreground hover:text-foreground active:scale-95"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> NOVA
          </button>
          <button
            type="button"
            onClick={() => setConvOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-charcoal-900/60 px-2.5 py-1.5 font-display text-[10px] tracking-[0.15em] text-muted-foreground hover:text-foreground active:scale-95"
          >
            <History className="h-3.5 w-3.5" /> HIST.
          </button>
          <button
            type="button"
            onClick={() => setCfgOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-charcoal-900/60 px-2.5 py-1.5 font-display text-[10px] tracking-[0.15em] text-muted-foreground hover:text-foreground active:scale-95"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> AJUSTAR
          </button>
          {/* Autoplay do TTS (item 3): fluidez pra quem quer conversar por voz,
              opcional pra quem precisa manter só texto. */}
          <button
            type="button"
            onClick={() => {
              const next = !autoplay;
              setAutoplay(next);
              autoplayRef.current = next;
              try {
                localStorage.setItem("wimi.tts.autoplay", next ? "1" : "0");
              } catch {
                /* noop */
              }
              if (!next) stopCurrentTts();
              else {
                // Destrava a política de autoplay do navegador tocando um MP3
                // vazio dentro do gesture. Sem isso, quando o `send` termina
                // segundos depois, `audio.play()` é rejeitada silenciosamente.
                void unlockAudioPlayback();
                toast.success("Autoplay ligado — vou ler as respostas em voz.");
              }
            }}
            aria-pressed={autoplay}
            aria-label={autoplay ? "Desligar autoplay da voz" : "Ligar autoplay da voz"}
            className={
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-display text-[10px] tracking-[0.15em] active:scale-95 " +
              (autoplay
                ? "border-ember bg-ember/15 text-ember"
                : "border-border bg-charcoal-900/60 text-muted-foreground hover:text-foreground")
            }
          >
            {autoplay ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            AUTO
          </button>
          {/* Chip compacto de nível de raciocínio (Rápido/Equilibrado/Profundo).
              Substitui a barra de 3 botões que ocupava linha inteira. */}
          <div ref={effortMenuRef} className="relative">
            {(() => {
              const map: Record<Effort, { label: string; Icon: typeof Zap }> = {
                low: { label: "Rápido", Icon: Zap },
                medium: { label: "Equilibrado", Icon: Scale },
                high: { label: "Profundo", Icon: Brain },
              };
              const cur = map[effort];
              const CurIcon = cur.Icon;
              return (
                <button
                  type="button"
                  onClick={() => setEffortMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={effortMenuOpen}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-charcoal-900/60 px-2.5 py-1.5 font-display text-[10px] tracking-[0.15em] text-muted-foreground hover:text-foreground active:scale-95"
                >
                  <CurIcon className="h-3.5 w-3.5" strokeWidth={2.2} /> {cur.label.toUpperCase()}
                </button>
              );
            })()}
            {effortMenuOpen ? (
              <div
                role="menu"
                className="absolute bottom-full right-0 z-40 mb-2 w-40 overflow-hidden rounded-xl border border-border bg-charcoal-900/95 shadow-xl backdrop-blur"
              >
                {(
                  [
                    { id: "low", label: "Rápido", Icon: Zap },
                    { id: "medium", label: "Equilibrado", Icon: Scale },
                    { id: "high", label: "Profundo", Icon: Brain },
                  ] as Array<{ id: Effort; label: string; Icon: typeof Zap }>
                ).map(({ id, label, Icon }) => {
                  const active = effort === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setEffort(id);
                        effortRef.current = id;
                        saveEffort(id);
                        setEffortMenuOpen(false);
                      }}
                      className={
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition " +
                        (active
                          ? "bg-ember/10 text-ember"
                          : "text-muted-foreground hover:bg-charcoal-800 hover:text-foreground")
                      }
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        {pendingImages.length ? (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt="preview"
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(i)}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-[10px] text-white"
                  aria-label="Remover imagem"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-1.5">
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleImageSelect(e.target.files)}
          />
          <button
            type="button"
            onClick={() => imgInputRef.current?.click()}
            disabled={thinking || pendingImages.length >= 3}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 active:scale-95"
            aria-label="Anexar imagem"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            disabled={thinking}
            className={
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl border active:scale-95 " +
              (listening
                ? "border-ember bg-ember/10 text-ember"
                : "border-border text-muted-foreground hover:text-foreground")
            }
            aria-label={listening ? "Parar de ouvir" : "Falar por voz"}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Wrapper relativo: mantém altura de 1 linha no layout mesmo quando
              expandido — o textarea vira overlay ancorado no rodapé e cresce
              pra cima, sobrepondo a barra de controles (voltar/nova/histórico
              /config/autoplay) sem empurrar o composer. */}
          <div ref={composerWrapRef} className="relative min-w-0 flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              onFocus={() => {
                if (expandMode === "auto") setComposerExpanded(true);
              }}
              rows={composerExpanded ? 5 : 1}
              placeholder={listening ? "Estou ouvindo…" : (settings.composer_placeholder?.trim() || "Fala comigo…")}
              className={
                composerExpanded
                  ? "absolute bottom-0 left-0 right-0 z-10 max-h-[40vh] w-full resize-none rounded-xl border border-ember/60 bg-charcoal-800 px-3 py-2.5 pl-10 text-foreground shadow-2xl outline-none placeholder:text-muted-foreground focus:border-ember/60"
                  : "max-h-28 w-full resize-none rounded-xl border border-input bg-charcoal-800 px-3 py-2.5 pl-10 text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
              }
            />
            <button
              type="button"
              onClick={() => setComposerExpanded((v) => !v)}
              aria-pressed={composerExpanded}
              aria-label={composerExpanded ? "Reduzir campo de texto" : "Expandir campo de texto"}
              className={
                "absolute left-1.5 z-20 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-charcoal-700 hover:text-foreground active:scale-95 " +
                (composerExpanded ? "bottom-1.5" : "top-1.5")
              }
            >
              {composerExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => send(input)}
            disabled={(!input.trim() && !pendingImages.length) || thinking}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40 active:scale-95"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* Drawer — histórico de conversas */}
      <Sheet open={convOpen} onOpenChange={setConvOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[85vh] max-w-[var(--shell-max)] flex-col rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <History className="h-4 w-4 text-ember" /> SUAS CONVERSAS
            </SheetTitle>
          </SheetHeader>
          <button
            type="button"
            onClick={startNewConversation}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> NOVA CONVERSA
          </button>
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4" data-lenis-prevent>
            {conversations.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhuma conversa ainda.
              </p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 " +
                    (c.id === conversationId
                      ? "border-ember/50 bg-ember/5"
                      : "border-border bg-charcoal-900/50")
                  }
                >
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      defaultValue={c.title}
                      onBlur={(e) => commitRename(c.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(c.id, e.currentTarget.value);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      maxLength={80}
                      aria-label="Novo nome da conversa"
                      className="min-w-0 flex-1 rounded-lg border border-ember/50 bg-charcoal-900 px-2 py-1 text-sm text-foreground outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm text-foreground">{c.title}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(c.updated_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRenamingId(c.id)}
                    aria-label={`Renomear ${c.title}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-ember"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConversation(c.id)}
                    aria-label="Apagar conversa"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet — configuração da IA */}
      <Sheet open={cfgOpen} onOpenChange={setCfgOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[88vh] max-w-[var(--shell-max)] flex-col rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-ember" /> REGULAR A IA
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4" data-lenis-prevent>
            <div>
              <p className="mb-1.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                NOME DA IA
              </p>
              <input
                value={settings.assistant_name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    assistant_name: e.target.value.slice(0, ASSISTANT_NAME_MAX),
                  })
                }
                onBlur={() => persistSettings(settings)}
                maxLength={ASSISTANT_NAME_MAX}
                placeholder={ASSISTANT_NAME_FALLBACK}
                aria-label="Nome da inteligência digital"
                className="w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember/60 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Como sua inteligência digital se chama. Em branco, ela é {ASSISTANT_NAME_FALLBACK}.
              </p>
            </div>
            <div>
              <p className="mb-1.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                FRASE DE CHAMADO
              </p>
              <input
                value={settings.composer_placeholder}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    composer_placeholder: e.target.value.slice(0, 80),
                  })
                }
                onBlur={() => persistSettings(settings)}
                maxLength={80}
                placeholder="Fala comigo…"
                aria-label="Frase de chamado do campo de mensagem"
                className="w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember/60 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                O que aparece dentro do campo de mensagem quando ele está vazio.
              </p>
            </div>
            <SegGroup
              label="PERSONALIDADE"
              value={settings.persona}
              onChange={(v) =>
                persistSettings({ ...settings, persona: v as ChatSettings["persona"] })
              }
              options={[
                { v: "caloroso", label: "Caloroso" },
                { v: "direto", label: "Direto" },
                { v: "tecnico", label: "Técnico" },
              ]}
            />
            <SegGroup
              label="TAMANHO DAS RESPOSTAS"
              value={settings.response_length}
              onChange={(v) =>
                persistSettings({
                  ...settings,
                  response_length: v as ChatSettings["response_length"],
                })
              }
              options={[
                { v: "curtas", label: "Curtas" },
                { v: "equilibrado", label: "Médio" },
                { v: "detalhadas", label: "Detalhadas" },
              ]}
            />
            <SegGroup
              label="FOCO"
              value={settings.focus}
              onChange={(v) => persistSettings({ ...settings, focus: v as ChatSettings["focus"] })}
              options={[
                { v: "geral", label: "Geral" },
                { v: "treino", label: "Treino" },
                { v: "nutricao", label: "Nutrição" },
                { v: "mente", label: "Mente" },
              ]}
            />
            <SegGroup
              label="AO ABRIR A IA"
              value={settings.open_mode}
              onChange={(v) =>
                persistSettings({ ...settings, open_mode: v as ChatSettings["open_mode"] })
              }
              options={[
                { v: "new", label: "Nova conversa" },
                { v: "last", label: "Última conversa" },
              ]}
            />
            <SegGroup
              label="VOZ DA IA"
              value={settings.voice_gender}
              onChange={(v) =>
                persistSettings({ ...settings, voice_gender: v as ChatSettings["voice_gender"] })
              }
              options={[
                { v: "feminina", label: "Feminina" },
                { v: "masculina", label: "Masculina" },
              ]}
            />
            <SegGroup
              label="EXPANSÃO DO CAMPO"
              value={expandMode}
              onChange={(v) => {
                const next = v === "auto" ? "auto" : "manual";
                setExpandMode(next);
                try {
                  localStorage.setItem("wimi.composer.expandMode", next);
                } catch {
                  /* noop */
                }
                // No modo manual, recolhe imediatamente se estava aberto por foco.
                if (next === "manual") setComposerExpanded(false);
              }}
              options={[
                { v: "manual", label: "Manual" },
                { v: "auto", label: "Automática" },
              ]}
            />
            <div>
              <p className="mb-1.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                INSTRUÇÕES PERSONALIZADAS
              </p>
              <textarea
                value={settings.custom_instructions}
                onChange={(e) =>
                  setSettings({ ...settings, custom_instructions: e.target.value.slice(0, 500) })
                }
                onBlur={() => persistSettings(settings)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: sou vegetariano, me chame de coach, evito lactose…"
                className="w-full resize-none rounded-lg border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember/60 focus:outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {savingCfg ? "salvando…" : `${settings.custom_instructions.length}/500`}
              </p>
            </div>
            {/* Acordos de acompanhamento da jornada — quando a WiMi se manifesta.
                Valores em minutos, editáveis pelo operador. */}
            <div>
              <p className="mb-1.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                GATILHOS DA JORNADA (MIN)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "preEnd", label: "Antes de acabar" },
                    { key: "atEnd", label: "Ao terminar" },
                    { key: "preStart", label: "Antes do próximo" },
                  ] as Array<{ key: "preEnd" | "atEnd" | "preStart"; label: string }>
                ).map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    <span className="font-display tracking-[0.15em]">{label.toUpperCase()}</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={agreements[key]}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                        updateAgreements({ [key]: n } as Partial<JourneyAgreements>);
                      }}
                      className="rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-center text-sm text-foreground focus:border-ember/60 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "text", label: "Texto no chat" },
                    { key: "voice", label: "Voz (TTS)" },
                    { key: "vibrate", label: "Vibrar" },
                    { key: "autoMic", label: "Abrir microfone" },
                  ] as Array<{ key: keyof JourneyNotifyChannels; label: string }>
                ).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-charcoal-900 px-2.5 py-2 text-[11px] text-foreground"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={agreements.notify[key]}
                      onChange={(e) => {
                        const next = { ...agreements.notify, [key]: e.target.checked };
                        updateAgreements({ notify: next });
                      }}
                      className="h-4 w-4 accent-ember"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                A WiMi manifesta a mensagem certa no bloco atual usando as suas últimas escolhas.
                Push no celular travado respeita esses canais e as horas silenciosas dos ajustes.
              </p>
            </div>

            <p className="rounded-lg border border-border bg-charcoal-800/40 p-2.5 text-[11px] text-muted-foreground">
              A IA sempre analisa seu progresso no app (streak, calorias do dia, treinos, hábitos,
              dieta) pra personalizar as respostas.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </MobileShell>
  );
}

function SegGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div>
      <p className="mb-1.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
        {label}
      </p>
      <div className="flex gap-1.5 rounded-lg border border-border p-1">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={
              "flex-1 rounded-md py-2 font-display text-[10px] tracking-[0.12em] transition-colors " +
              (value === o.v
                ? "bg-ember text-charcoal-900"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {o.label.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Card de proposta (editável em tempo real) ---------- */
function ProposalCard({
  msg,
  onChange,
  onConfirm,
  onCancel,
  onUndo,
}: {
  msg: ProposalMsg;
  onChange: (d: Proposal["data"]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const p = msg.proposal;
  const label =
    p.kind === "habito"
      ? "HÁBITO"
      : p.kind === "compromisso"
        ? "COMPROMISSO"
        : p.kind === "treino"
          ? "TREINO"
          : "DIETA";

  return (
    <div className="flex justify-start">
      <div className="forge-raised w-full max-w-[92%] rounded-2xl border border-ember/30 bg-charcoal-800 p-3.5">
        <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-ember">
          PROPOSTA · {label}
        </p>

        {msg.status === "pending" ? (
          <>
            {p.kind === "habito" && (
              <HabitEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />
            )}
            {p.kind === "compromisso" && (
              <CommitmentEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />
            )}
            {p.kind === "treino" && (
              <TreinoEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />
            )}
            {p.kind === "dieta" && (
              <DietEditor data={p.data} onChange={onChange as (d: typeof p.data) => void} />
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ember py-2.5 font-display text-sm tracking-wide text-charcoal-900 active:scale-[0.99]"
              >
                <Check className="h-4 w-4" strokeWidth={3} /> Confirmar
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-charcoal-900 px-3.5 py-2.5 font-display text-sm text-muted-foreground active:scale-[0.99]"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            </div>
          </>
        ) : msg.status === "done" ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="font-display text-[11px] tracking-[0.2em] text-ember">✓ CRIADO</span>
              {(msg.ctas ?? (msg.cta ? [msg.cta] : [])).map((cta) => (
                <Link
                  key={`${cta.to}:${cta.label}`}
                  to={cta.to}
                  className="inline-flex items-center gap-1 font-display text-[11px] tracking-[0.15em] text-muted-foreground"
                >
                  {cta.label.toUpperCase()} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={onUndo}
              className="flex items-center gap-1 text-[11px] tracking-[0.2em] text-muted-foreground active:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5" /> DESFAZER
            </button>
          </div>
        ) : (
          <p className="font-display text-[11px] tracking-[0.2em] text-muted-foreground">
            CANCELADO
          </p>
        )}
      </div>
    </div>
  );
}

const fieldCls =
  "w-full rounded-lg border border-border bg-charcoal-900 px-2.5 py-2 text-sm text-foreground focus:border-ember/60 focus:outline-none";

function HabitEditor({
  data,
  onChange,
}: {
  data: Extract<Proposal, { kind: "habito" }>["data"];
  onChange: (d: Extract<Proposal, { kind: "habito" }>["data"]) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        className={fieldCls}
        value={data.titulo}
        onChange={(e) => onChange({ ...data, titulo: e.target.value })}
        placeholder="Título do hábito"
      />
      <div className="flex gap-2">
        <select
          className={fieldCls}
          value={data.frequencia}
          onChange={(e) =>
            onChange({ ...data, frequencia: e.target.value as typeof data.frequencia })
          }
        >
          <option value="diario">Diário</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
        <input
          type="number"
          min={1}
          className={fieldCls + " w-24"}
          value={data.meta ?? 1}
          onChange={(e) => onChange({ ...data, meta: Number(e.target.value) || 1 })}
          aria-label="meta"
        />
      </div>
    </div>
  );
}

function CommitmentEditor({
  data,
  onChange,
}: {
  data: Extract<Proposal, { kind: "compromisso" }>["data"];
  onChange: (d: Extract<Proposal, { kind: "compromisso" }>["data"]) => void;
}) {
  const dias = data.dias_semana ?? [];
  const toggle = (i: number) => {
    const next = dias.includes(i) ? dias.filter((d) => d !== i) : [...dias, i].sort();
    onChange({ ...data, dias_semana: next });
  };
  return (
    <div className="space-y-2">
      <input
        className={fieldCls}
        value={data.titulo}
        onChange={(e) => onChange({ ...data, titulo: e.target.value })}
        placeholder="Título"
      />
      <div className="flex gap-1">
        {DIAS.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={
              "grid h-8 flex-1 place-items-center rounded-lg border font-display text-xs " +
              (dias.includes(i)
                ? "border-ember bg-ember/15 text-ember"
                : "border-border text-muted-foreground")
            }
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="time"
          className={fieldCls}
          value={data.horario_inicio ?? ""}
          onChange={(e) => onChange({ ...data, horario_inicio: e.target.value })}
          aria-label="início"
        />
        <input
          type="time"
          className={fieldCls}
          value={data.horario_fim ?? ""}
          onChange={(e) => onChange({ ...data, horario_fim: e.target.value })}
          aria-label="fim"
        />
      </div>
    </div>
  );
}

function TreinoEditor({
  data,
  onChange,
}: {
  data: Extract<Proposal, { kind: "treino" }>["data"];
  onChange: (d: Extract<Proposal, { kind: "treino" }>["data"]) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        className={fieldCls}
        value={data.nome}
        onChange={(e) => onChange({ ...data, nome: e.target.value })}
        placeholder="Nome do treino"
      />
      {data.dias.map((dia, di) => (
        <div key={di} className="rounded-lg border border-border bg-charcoal-900 p-2">
          <div className="mb-1 flex gap-2">
            <input
              className={fieldCls + " w-20"}
              value={dia.dia}
              onChange={(e) => {
                const dias = [...data.dias];
                dias[di] = { ...dia, dia: e.target.value };
                onChange({ ...data, dias });
              }}
            />
            <input
              className={fieldCls}
              value={dia.foco ?? ""}
              placeholder="foco"
              onChange={(e) => {
                const dias = [...data.dias];
                dias[di] = { ...dia, foco: e.target.value };
                onChange({ ...data, dias });
              }}
            />
          </div>
          {dia.exercicios.map((ex, ei) => (
            <div key={ei} className="mt-1 flex gap-1">
              <input
                className={fieldCls}
                value={ex.nome}
                onChange={(e) => {
                  const dias = [...data.dias];
                  const exs = [...dia.exercicios];
                  exs[ei] = { ...ex, nome: e.target.value };
                  dias[di] = { ...dia, exercicios: exs };
                  onChange({ ...data, dias });
                }}
              />
              <input
                type="number"
                className={fieldCls + " w-12"}
                value={ex.series ?? 3}
                onChange={(e) => {
                  const dias = [...data.dias];
                  const exs = [...dia.exercicios];
                  exs[ei] = { ...ex, series: Number(e.target.value) || 0 };
                  dias[di] = { ...dia, exercicios: exs };
                  onChange({ ...data, dias });
                }}
                aria-label="séries"
              />
              <input
                className={fieldCls + " w-16"}
                value={ex.reps ?? ""}
                placeholder="reps"
                onChange={(e) => {
                  const dias = [...data.dias];
                  const exs = [...dia.exercicios];
                  exs[ei] = { ...ex, reps: e.target.value };
                  dias[di] = { ...dia, exercicios: exs };
                  onChange({ ...data, dias });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const dias = [...data.dias];
                  dias[di] = { ...dia, exercicios: dia.exercicios.filter((_, x) => x !== ei) };
                  onChange({ ...data, dias });
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DietEditor({
  data,
  onChange,
}: {
  data: Extract<Proposal, { kind: "dieta" }>["data"];
  onChange: (d: Extract<Proposal, { kind: "dieta" }>["data"]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className={fieldCls}
          value={data.nome ?? ""}
          placeholder="Nome da dieta"
          onChange={(e) => onChange({ ...data, nome: e.target.value })}
        />
        <input
          type="number"
          className={fieldCls + " w-28"}
          value={data.hidratacao_ml ?? 0}
          placeholder="água (ml)"
          onChange={(e) => onChange({ ...data, hidratacao_ml: Number(e.target.value) || 0 })}
          aria-label="hidratação ml"
        />
      </div>
      {data.refeicoes.map((r, ri) => (
        <div key={ri} className="rounded-lg border border-border bg-charcoal-900 p-2">
          <div className="mb-1 flex gap-2">
            <input
              className={fieldCls + " w-20"}
              value={r.horario ?? ""}
              placeholder="hora"
              onChange={(e) => {
                const rs = [...data.refeicoes];
                rs[ri] = { ...r, horario: e.target.value };
                onChange({ ...data, refeicoes: rs });
              }}
            />
            <input
              className={fieldCls}
              value={r.nome}
              onChange={(e) => {
                const rs = [...data.refeicoes];
                rs[ri] = { ...r, nome: e.target.value };
                onChange({ ...data, refeicoes: rs });
              }}
            />
          </div>
          <textarea
            className={fieldCls}
            rows={2}
            value={r.itens.join(", ")}
            placeholder="itens separados por vírgula"
            onChange={(e) => {
              const rs = [...data.refeicoes];
              rs[ri] = {
                ...r,
                itens: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              onChange({ ...data, refeicoes: rs });
            }}
          />
        </div>
      ))}
    </div>
  );
}
