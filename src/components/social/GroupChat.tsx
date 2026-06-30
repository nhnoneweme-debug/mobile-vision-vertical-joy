import { useEffect, useRef, useState } from "react";
import { Send, Trash2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import {
  deleteGroupMessage,
  listGroupMessages,
  sendGroupMessage,
  subscribeGroupMessages,
  type GroupMessage,
} from "@/lib/group-chat";

export function GroupChat({
  groupId,
  groupName,
  userId,
}: {
  groupId: string;
  groupName: string;
  userId: string;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    let unsub = () => {};
    (async () => {
      try {
        const list = await listGroupMessages(groupId);
        setMessages(list);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar chat");
      } finally {
        setLoading(false);
      }
      unsub = subscribeGroupMessages(groupId, (m) => {
        setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      });
    })();
    return () => unsub();
  }, [groupId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await sendGroupMessage(groupId, t);
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGroupMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao apagar");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-charcoal-800/40">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessagesSquare className="h-4 w-4 text-ember" />
        <p className="font-display text-[11px] tracking-[0.25em] text-muted-foreground">
          CHAT — {groupName.toUpperCase()}
        </p>
      </div>

      <div ref={scrollRef} className="max-h-[320px] min-h-[180px] space-y-2 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Ninguém falou ainda. Quebre o gelo.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div
                key={m.id}
                className={`group flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-ember/20 text-foreground"
                      : "border border-border bg-charcoal-900/60 text-foreground"
                  }`}
                >
                  {!mine && (
                    <p className="font-display text-[10px] tracking-[0.2em] text-ember">
                      {m.author_name ?? "Viajante"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  <div className="mt-0.5 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Apagar"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Escreva para a guilda…"
          className="flex-1 rounded-full border border-border bg-charcoal-900/60 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-charcoal-900 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
