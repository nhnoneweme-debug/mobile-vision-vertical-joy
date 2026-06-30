import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Moon, Send, BedDouble } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dormir")({
  head: () => ({ meta: [{ title: "Dormir — Personal IA" }] }),
  component: DormirPage,
});

function DormirPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = new DefaultChatTransport({
    api: "/api/sleep-chat",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const { messages, sendMessage, status } = useChat({
    id: "dormir",
    transport,
    messages: [
      {
        id: "intro",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Boa noite. Conta — como foi seu dia? Pode dar um dump cru, eu organizo.",
          },
        ],
      },
    ] as UIMessage[],
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-charcoal-900 via-charcoal-900 to-indigo-950/30">
      <header className="border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/80 text-charcoal-900 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]">
              <Moon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl tracking-wide">DORMIR</h1>
              <p className="text-[11px] text-muted-foreground">
                Dump do dia. Eu organizo, registro e te devolvo o resumo.
              </p>
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
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? "bg-indigo-500/20 text-foreground"
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
        {busy && (
          <div className="text-xs italic text-muted-foreground">organizando…</div>
        )}
      </div>

      <div className="border-t border-border bg-charcoal-900/95 px-3 py-3 backdrop-blur-xl">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {[
            "foi um dia pesado",
            "vitória do dia foi…",
            "gratidão",
            "tô indo pra cama agora",
            "feche o ritual",
          ].map((q) => (
            <button
              key={q}
              onClick={() => sendMessage({ text: q })}
              disabled={busy || !token}
              className="shrink-0 rounded-full border border-border bg-charcoal-800/60 px-3 py-1 text-[11px] text-muted-foreground disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) {
                  sendMessage({ text: input.trim() });
                  setInput("");
                }
              }
            }}
            rows={1}
            placeholder="dump do dia…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => {
              if (!input.trim()) return;
              sendMessage({ text: input.trim() });
              setInput("");
            }}
            disabled={busy || !token || !input.trim()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-indigo-500 text-charcoal-900 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
