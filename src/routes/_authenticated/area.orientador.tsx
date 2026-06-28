import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/area/orientador")({
  head: () => ({
    meta: [
      { title: "Orientador — Personal IA" },
      { name: "description", content: "Conversa contínua com o Orientador do mundo Personal IA." },
    ],
  }),
  component: OrientadorPage,
});

type Row = { role: string; content: string };

function rowsToUI(rows: Row[]): UIMessage[] {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r, i) => ({
      id: `db-${i}`,
      role: r.role as "user" | "assistant",
      parts: [{ type: "text", text: r.content }],
    }));
}

function OrientadorPage() {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      setToken(sess.session?.access_token ?? null);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase
        .from("oracle_messages")
        .select("role,content")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: true })
        .limit(80);
      setInitial(rowsToUI(((data ?? []) as Row[]).filter((r) => r.role !== "system")));
    })();
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    [token],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "orientador",
    messages: initial ?? [],
    transport,
    onError: (e) => toast.error(e.message || "Falha ao falar com o Orientador"),
  });

  // Sync once initial history loads.
  useEffect(() => {
    if (initial && messages.length === 0 && initial.length > 0) {
      setMessages(initial);
    }
  }, [initial, messages.length, setMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !token) return;
    setInput("");
    await sendMessage({ text });
  }

  async function handleReset() {
    if (!confirm("Apagar toda a conversa com o Orientador?")) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    await supabase.from("oracle_messages").delete().eq("user_id", user.user.id);
    setMessages([]);
    toast.success("Conversa reiniciada");
  }

  return (
    <MobileShell>
      <header className="sticky top-0 z-20 border-b border-border bg-charcoal-900/85 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ember" />
            <div>
              <h1 className="font-display text-xl tracking-wide">ORIENTADOR</h1>
              <p className="text-[11px] text-muted-foreground">Entidade contínua · memória ativa</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-ember"
            aria-label="Reiniciar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 pb-40">
        {messages.length === 0 && (
          <div className="rounded-xl border border-border bg-charcoal-800/40 p-4 text-sm text-muted-foreground">
            <p className="font-display text-ember">O ORIENTADOR AGUARDA.</p>
            <p className="mt-2 leading-relaxed">
              Pergunte sobre sua próxima missão, peça uma leitura do seu progresso, ou descreva
              onde você travou. Ele lembra de cada conversa.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? "bg-ember/20 text-foreground"
                    : "border border-border bg-charcoal-800/60 text-foreground"
                }`}
              >
                {mine ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-block animate-pulse">o orientador medita…</span>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-[480px] border-t border-border bg-charcoal-900/95 px-3 py-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Fale com o Orientador…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-charcoal-800/60 px-3 py-2 text-sm outline-none focus:border-ember"
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim() || !token}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-ember text-charcoal-900 transition-opacity disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BottomNav />
    </MobileShell>
  );
}
