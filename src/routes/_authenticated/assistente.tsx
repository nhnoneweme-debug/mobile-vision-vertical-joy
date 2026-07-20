import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
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

// Saudação inicial antes das settings chegarem; troca pelo nome escolhido assim
// que carregam (o fallback é "WiMi").
const GREETING = assistantGreeting(ASSISTANT_NAME_FALLBACK);

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME_FALLBACK} — Inteligência Digital` }] }),
  component: AssistantPage,
});

type ImageAttachment = { base64: string; mediaType: string };
type ProposalMsg = {
  id: number;
  role: "proposal";
  proposal: Proposal;
  status: "pending" | "done" | "cancel";
  cta?: { to: string; label: string };
};
type Msg =
  | { id: number; role: "assistant"; text: string }
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
  // Estado do TTS por mensagem: idle | loading | playing | paused | error.
  // Apenas UMA mensagem toca por vez; ao trocar, aborta a anterior.
  type TtsState = "loading" | "playing" | "paused";
  const [ttsMsgId, setTtsMsgId] = useState<number | null>(null);
  const [ttsState, setTtsState] = useState<TtsState>("loading");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  // Sequência monotônica: só callbacks do áudio "atual" têm efeito.
  // Sem isso, um MP3 antigo que erra depois de tocar aciona speakFallback e
  // dispara uma segunda voz (Web Speech) por cima do novo áudio.
  const ttsGenRef = useRef(0);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const { canGoBack, goBack } = useGoBack();

  // Restaura preferência de autoplay do dispositivo (item 3).
  useEffect(() => {
    try {
      setAutoplay(localStorage.getItem("wimi.tts.autoplay") === "1");
      const mode = localStorage.getItem("wimi.composer.expandMode");
      if (mode === "auto" || mode === "manual") setExpandMode(mode);
    } catch {
      /* noop */
    }
  }, []);

  const {
    listening,
    supported: sttSupported,
    interim: sttInterim,
    start: startListening,
    stop: stopListening,
  } = useSpeechToText((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));

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

  function toggleVoice() {
    if (voiceMode) {
      stopListening();
      setVoiceMode(false);
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
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* noop */
      }
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

  /**
   * Toca o TTS da mensagem `msgId` com estado ao vivo (loading → playing).
   * Se a mesma mensagem já está tocando, pausa; se está pausada, retoma;
   * se outra está tocando, aborta e recomeça.
   */
  async function playMessageTts(msgId: number, text: string) {
    if (!text.trim()) return;
    // Se já é a mensagem ativa, alterna play/pause.
    if (ttsMsgId === msgId && audioRef.current) {
      if (ttsState === "playing") {
        audioRef.current.pause();
        setTtsState("paused");
      } else if (ttsState === "paused") {
        audioRef.current.play().catch(() => stopCurrentTts());
        setTtsState("playing");
      }
      return;
    }
    // Nova mensagem — cancela a anterior.
    stopCurrentTts();
    setTtsMsgId(msgId);
    setTtsState("loading");
    try {
      const r = await fetch("/api/assistant-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, gender: settings.voice_gender }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setSpeaking(true);
        setTtsState("playing");
      };
      audio.onpause = () => {
        // `pause` também dispara ao terminar em alguns navegadores; `ended` cobre.
        if (!audio.ended) setTtsState("paused");
      };
      audio.onended = () => {
        setSpeaking(false);
        stopCurrentTts();
      };
      audio.onerror = () => {
        stopCurrentTts();
        speakFallback(text, msgId);
      };
      await audio.play();
    } catch {
      speakFallback(text, msgId);
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
    const utter = new SpeechSynthesisUtterance(text);
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
      // Abrir a IA SEMPRE começa uma sessão nova — retomar a última fazia a tela
      // abrir no meio de um assunto velho. O histórico fica no drawer.
      try {
        setConversations(await fnListConversations());
      } catch {
        /* sem histórico */
      }
      try {
        const s = await fnGetSettings();
        setSettings(s);
        // A saudação carrega o nome escolhido; só troca se ninguém falou ainda.
        setMsgs((prev) =>
          prev.length === 1 && prev[0].role === "assistant"
            ? [{ id: nid(), role: "assistant", text: assistantGreeting(assistantName(s)) }]
            : prev,
        );
      } catch {
        /* usa defaults */
      }
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
        },
        body: JSON.stringify({
          messages: [...convo, { role: "user", text: t, ...(imgs.length ? { images: imgs } : {}) }],
          conversation_id: conversationId ?? undefined,
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
      const shouldSpeak = (voiceMode || autoplay) && full.trim() && assistantId != null;
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
        patchProposal(msg.id, { status: "done", cta: { to: "/agenda", label: "Ver na Agenda" } });
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

  return (
    <MobileShell>
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
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Inteligência Digital
            {voiceMode ? (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-ember/15 px-1.5 py-0.5 text-[9px] font-display tracking-[0.15em] text-ember">
                {listening ? "🎙 OUVINDO" : speaking ? "🔊 FALANDO" : "🎤 VOZ"}
              </span>
            ) : null}
          </p>
        </div>
      </header>

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
                <div className="forge-card max-w-[86%] rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  {/* A IA responde em markdown (**negrito**, listas). Renderizar
                      como texto puro mostrava os asteriscos crus pro usuário —
                      mesmo padrão já usado no /conversar e no DumpChat. */}
                  <div className="prose prose-sm prose-invert max-w-none text-sm leading-snug text-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-display">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
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

      <div className="h-28" />

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        {/* Preview ao vivo da transcrição enquanto o mic está aberto: mostra o
            parcial da fala em curso pra o usuário auditar. O texto final já cai
            no textarea abaixo — a soma dos dois é o que será enviado. */}
        {listening ? (
          <div
            aria-live="polite"
            className="mb-2 flex items-start gap-2 rounded-lg border border-ember/30 bg-ember/5 px-3 py-2"
          >
            <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-ember" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-[9px] tracking-[0.18em] text-ember/80">
                OUVINDO — AUDITE A TRANSCRIÇÃO
              </div>
              <div
                className="mt-0.5 max-h-16 overflow-y-auto font-mono text-[12px] leading-snug text-foreground/90"
                style={{ overflowWrap: "anywhere" }}
              >
                {sttInterim || (
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
              try {
                localStorage.setItem("wimi.tts.autoplay", next ? "1" : "0");
              } catch {
                /* noop */
              }
              if (!next) stopCurrentTts();
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
          <div className="relative min-w-0 flex-1">
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
              placeholder={listening ? "Estou ouvindo…" : "Fala comigo…"}
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
              className="absolute left-1.5 top-1.5 z-20 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-charcoal-700 hover:text-foreground active:scale-95"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-[11px] tracking-[0.2em] text-ember">✓ CRIADO</span>
              {msg.cta && (
                <Link
                  to={msg.cta.to}
                  className="inline-flex items-center gap-1 font-display text-[11px] tracking-[0.15em] text-muted-foreground"
                >
                  {msg.cta.label.toUpperCase()} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
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
