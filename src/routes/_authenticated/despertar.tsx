import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { startWakeSession, markAwake, getActiveSession } from "@/lib/wake.functions";

export const Route = createFileRoute("/_authenticated/despertar")({
  head: () => ({ meta: [{ title: "Despertar — Personal IA" }] }),
  component: DespertarPage,
  validateSearch: (s: Record<string, unknown>) => ({ s: typeof s.s === "string" ? s.s : undefined }),
});

function DespertarPage() {
  const { s: searchSession } = Route.useSearch();
  const navigate = useNavigate();
  const start = useServerFn(startWakeSession);
  const wake = useServerFn(markAwake);
  const getActive = useServerFn(getActiveSession);
  const [sessionId, setSessionId] = useState<string | undefined>(searchSession);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      if (sessionId) return;
      const existing = await getActive();
      if (existing) {
        setSessionId(existing.id);
      } else {
        const s = await start({ data: {} });
        setSessionId(s.id);
      }
    })();
  }, []);

  const transport = new DefaultChatTransport({
    api: "/api/wake-chat",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: { sessionId },
  });

  const { messages, sendMessage, status } = useChat({
    id: sessionId ?? "despertar",
    transport,
    messages: [
      {
        id: "intro",
        role: "assistant",
        parts: [{ type: "text", text: "Oi, tô aqui no controle. Música, pensamento, deixar tocar ou snooze?" }],
      },
    ] as UIMessage[],
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function acordei() {
    if (!sessionId) return;
    await wake({ data: { session_id: sessionId, mood: "bem" } });
    navigate({ to: "/sonhos" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-charcoal-900 via-charcoal-900 to-ember/10">
      <header className="border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-charcoal-900 shadow-[0_8px_24px_-6px_var(--ember)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl tracking-wide">DESPERTAR</h1>
              <p className="text-[11px] text-muted-foreground">A IA negocia. Você decide.</p>
            </div>
          </div>
          <button
            onClick={acordei}
            className="flex items-center gap-1 rounded-full bg-ember px-3 py-2 text-xs font-medium text-charcoal-900"
          >
            <Sun className="h-4 w-4" /> Acordei
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
                  mine ? "bg-ember/20 text-foreground" : "border border-border bg-charcoal-800/60"
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
          <div className="text-xs italic text-muted-foreground">a companheira está respondendo…</div>
        )}
      </div>

      <div className="border-t border-border bg-charcoal-900/95 px-3 py-3 backdrop-blur-xl">
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {[
            "me dá mais 10",
            "toca uma música calma",
            "me joga um pensamento",
            "acordei!",
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
            placeholder="responda…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-ember"
          />
          <button
            onClick={() => {
              if (!input.trim()) return;
              sendMessage({ text: input.trim() });
              setInput("");
            }}
            disabled={busy || !token || !input.trim()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
