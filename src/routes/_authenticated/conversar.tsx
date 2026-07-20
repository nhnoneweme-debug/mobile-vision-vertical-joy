import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Zap, Scale, Brain } from "lucide-react";
import { authHeaders } from "@/lib/auth-headers";
import { clientMomentHeaders } from "@/lib/client-moment";
import { MobileShell } from "@/components/shell/MobileShell";
import { HeaderBackButton } from "@/components/shell/HeaderBackButton";

export const Route = createFileRoute("/_authenticated/conversar")({
  head: () => ({ meta: [{ title: "Conversar com o Orientador — Weme" }] }),
  component: ConversarPage,
});

type Effort = "low" | "medium" | "high";
const EFFORT_KEY = "wimi:chat-effort";

function loadEffort(): Effort {
  if (typeof window === "undefined") return "medium";
  const v = window.localStorage.getItem(EFFORT_KEY);
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function ConversarPage() {
  const [input, setInput] = useState("");
  const [effort, setEffort] = useState<Effort>("medium");
  const effortRef = useRef<Effort>("medium");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hidrata a preferência salva sem quebrar SSR.
  useEffect(() => {
    const e = loadEffort();
    setEffort(e);
    effortRef.current = e;
  }, []);

  // Mantém o ref sempre com o valor atual — o transport lê no envio.
  useEffect(() => {
    effortRef.current = effort;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EFFORT_KEY, effort);
    }
  }, [effort]);

  const transportRef = useRef<DefaultChatTransport<UIMessage> | null>(null);
  if (!transportRef.current) {
    transportRef.current = new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => ({ ...(await authHeaders()), ...clientMomentHeaders() }),
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: { id, messages, effort: effortRef.current },
      }),
    });
  }

  const { messages, sendMessage, status } = useChat({
    id: "orientador",
    transport: transportRef.current,
    messages: [
      {
        id: "intro",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Fala comigo. O que pesa hoje? Posso te orientar no treino, na rotina ou na cabeça.",
          },
        ],
      },
    ] as UIMessage[],
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  function submit() {
    const t = input.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-4 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <HeaderBackButton onlyMobile />
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">ORIENTADOR</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Converse — orientação sobre treino, rotina e mente
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("")
            .trim();
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed " +
                  (mine
                    ? "rounded-br-md bg-ember text-charcoal-900"
                    : "forge-card rounded-bl-md text-foreground")
                }
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
        {busy && <div className="text-xs italic text-muted-foreground">pensando…</div>}
      </div>

      <div className="h-32" />

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        <EffortSelector value={effort} onChange={setEffort} />
        <div className="mt-2 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Escreva para o Orientador…"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-charcoal-800 px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !input.trim()}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40 active:scale-95"
          >
            <Send className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

function EffortSelector({ value, onChange }: { value: Effort; onChange: (v: Effort) => void }) {
  const opts: Array<{ id: Effort; label: string; Icon: typeof Zap }> = [
    { id: "low", label: "Rápido", Icon: Zap },
    { id: "medium", label: "Equilibrado", Icon: Scale },
    { id: "high", label: "Profundo", Icon: Brain },
  ];
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Nível de raciocínio"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-charcoal-800/60 p-1"
      >
        {opts.map(({ id, label, Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              className={
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition " +
                (active
                  ? "bg-ember text-charcoal-900 shadow"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>
      {value === "high" && (
        <p className="mt-1 px-1 text-[10px] text-muted-foreground">
          respostas mais lentas e detalhadas
        </p>
      )}
    </div>
  );
}
