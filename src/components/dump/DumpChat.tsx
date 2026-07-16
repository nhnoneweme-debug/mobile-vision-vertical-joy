import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Moon, Send, BedDouble, Sunrise, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import type { RitualType } from "@/lib/ritual";

// Chat de dump — a pessoa despeja (falando ou escrevendo) e a IA organiza e
// registra. Mesma mecânica de manhã (sonhos) e de noite (o dia); muda a persona
// do servidor, a paleta e os atalhos.
const MODES = {
  morning: {
    title: "DESPERTAR",
    sub: "Dump do sonho. Eu organizo, registro e te devolvo o resumo.",
    icon: Sunrise,
    intro:
      "Bom dia. Antes que o sonho escape — o que você lembra? Pode falar cru, sem ordem, eu organizo.",
    placeholder: "dump do sonho…",
    quick: [
      "sonhei que…",
      "não lembro o sonho",
      "acordei cansado",
      "dormi bem",
      "feche o ritual",
    ],
    accent: {
      bg: "from-charcoal-900 via-charcoal-900 to-amber-950/30",
      chip: "bg-amber-400/80",
      shadow: "shadow-[0_8px_24px_-6px_rgba(251,191,36,0.6)]",
      bubble: "bg-amber-400/20",
      focus: "focus:border-amber-300",
      send: "bg-amber-400",
    },
  },
  night: {
    title: "DORMIR",
    sub: "Dump do dia. Eu organizo, registro e te devolvo o resumo.",
    icon: Moon,
    intro: "Boa noite. Conta — como foi seu dia? Pode dar um dump cru, eu organizo.",
    placeholder: "dump do dia…",
    quick: [
      "foi um dia pesado",
      "vitória do dia foi…",
      "gratidão",
      "tô indo pra cama agora",
      "feche o ritual",
    ],
    accent: {
      bg: "from-charcoal-900 via-charcoal-900 to-indigo-950/30",
      chip: "bg-indigo-500/80",
      shadow: "shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]",
      bubble: "bg-indigo-500/20",
      focus: "focus:border-indigo-400",
      send: "bg-indigo-500",
    },
  },
} as const;

export function DumpChat({ mode }: { mode: RitualType }) {
  const cfg = MODES[mode];
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  // A fala vai caindo no campo de texto; a pessoa revisa e envia.
  const { listening, supported, toggle } = useSpeechToText((text) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  });

  const transport = new DefaultChatTransport({
    api: "/api/sleep-chat",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: { mode },
  });

  const { messages, sendMessage, status } = useChat({
    id: `dump-${mode}`,
    transport,
    messages: [
      { id: "intro", role: "assistant", parts: [{ type: "text", text: cfg.intro }] },
    ] as UIMessage[],
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const Icon = cfg.icon;

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    sendMessage({ text: t });
    setInput("");
  }

  function onMicClick() {
    if (!supported) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    toggle();
  }

  return (
    <div className={`flex min-h-[100dvh] flex-col bg-gradient-to-b ${cfg.accent.bg}`}>
      <header className="border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[var(--shell-max)] items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-charcoal-900 ${cfg.accent.chip} ${cfg.accent.shadow}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl tracking-wide">{cfg.title}</h1>
              <p className="text-[11px] text-muted-foreground">{cfg.sub}</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/jornada" })}
            className="flex items-center gap-1 rounded-full border border-border bg-charcoal-800/60 px-3 py-2 text-xs text-muted-foreground"
          >
            <BedDouble className="h-4 w-4" /> Jornada
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-[var(--shell-max)] space-y-3">
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim();
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    mine
                      ? `${cfg.accent.bubble} text-foreground`
                      : "border border-border bg-charcoal-800/60"
                  }`}
                >
                  {mine ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1">
                      <ReactMarkdown>{text || "…"}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy && <div className="text-xs italic text-muted-foreground">organizando…</div>}
        </div>
      </div>

      <div className="border-t border-border bg-charcoal-900/95 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[var(--shell-max)]">
          {listening && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-ember">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
              ouvindo — pode falar
            </p>
          )}
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {cfg.quick.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={busy || !token}
                className="shrink-0 rounded-full border border-border bg-charcoal-800/60 px-3 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={onMicClick}
              aria-label={listening ? "Parar de ouvir" : "Falar o dump"}
              aria-pressed={listening}
              className={
                "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition-colors " +
                (listening
                  ? "border-ember bg-ember text-charcoal-900"
                  : "border-border bg-charcoal-800/60 text-muted-foreground")
              }
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={listening ? "falando…" : cfg.placeholder}
              className={`max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none ${cfg.accent.focus}`}
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !token || !input.trim()}
              className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl text-charcoal-900 disabled:opacity-40 ${cfg.accent.send}`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
