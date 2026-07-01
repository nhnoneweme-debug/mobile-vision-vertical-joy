import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  listMessages,
  markThreadRead,
  sendMessage,
  subscribeThread,
  type OrientadorMessage,
} from "@/lib/orientador-chat";
import { supabase } from "@/integrations/supabase/client";

export function ChatThread({
  orientadorId,
  studentId,
  heightClass = "h-[60vh]",
}: {
  orientadorId: string;
  studentId: string;
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<OrientadorMessage[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
      try {
        const rows = await listMessages(orientadorId, studentId);
        setMessages(rows);
        await markThreadRead(orientadorId, studentId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar.");
      } finally {
        setLoading(false);
      }
      unsub = subscribeThread(orientadorId, studentId, (m) => {
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
        void markThreadRead(orientadorId, studentId);
      });
    })();
    return () => {
      unsub?.();
    };
  }, [orientadorId, studentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ orientadorId, studentId, body });
      setText("");
      // Optimistic reload of latest if realtime lags:
      const rows = await listMessages(orientadorId, studentId);
      setMessages(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card">
      <div className={`flex-1 overflow-y-auto p-3 ${heightClass}`}>
        {loading ? (
          <p className="text-center text-xs text-muted-foreground">Carregando…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = m.sender_id === me;
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                      (mine
                        ? "bg-ember text-charcoal-950"
                        : "bg-charcoal-800 text-foreground")
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={
                        "mt-1 text-[10px] tracking-widest " +
                        (mine ? "text-charcoal-950/60" : "text-muted-foreground")
                      }
                    >
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
            <div ref={endRef} />
          </ul>
        )}
      </div>
      {error && (
        <p className="border-t border-border px-3 py-1 text-[11px] text-destructive">
          {error}
        </p>
      )}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          className="flex-1 rounded-xl border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground outline-none focus:border-ember"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-ember text-charcoal-950 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
