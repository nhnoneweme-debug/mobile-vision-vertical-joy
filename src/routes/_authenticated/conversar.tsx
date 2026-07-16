import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send } from "lucide-react";
import { authHeaders } from "@/lib/auth-headers";
import { MobileShell } from "@/components/shell/MobileShell";
import { HeaderBackButton } from "@/components/shell/HeaderBackButton";

export const Route = createFileRoute("/_authenticated/conversar")({
  head: () => ({ meta: [{ title: "Conversar com o Orientador — Weme" }] }),
  component: ConversarPage,
});

function ConversarPage() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    headers: authHeaders,
  });

  const { messages, sendMessage, status } = useChat({
    id: "orientador",
    transport,
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
        {/* A barra inferior some aqui (o composer ocupa o rodapé), então a
            saída fica no header. No desktop quem traz o voltar é a sidebar. */}
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

      <div className="h-28" />

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-border bg-charcoal-900/95 px-3 pb-6 pt-2.5 backdrop-blur-xl"
        style={{ maxWidth: "var(--shell-max)" }}
      >
        <div className="flex items-end gap-2">
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
